// Entity tables: one table per kind (colonist, item, later creature), each a list of rows by
// rising id, with one id counter for every kind. The system that owns a kind declares its fields;
// the save check and the ledger's seal read those declarations instead of per-field code.
import type { EntityRow, WorldState } from '../core/index.ts';

/**
 * A field's type. `count` is a whole number 0 or more; `entity` an entity id (0 for none); `event`
 * a ledger id (0 for none); `events` a list of ledger ids; `text` a string.
 */
export type FieldType = 'int' | 'count' | 'number' | 'text' | 'entity' | 'event' | 'events';

/** The fields of one kind's rows, by name (the `id` field is implied). */
export type TableSchema = Readonly<Record<string, FieldType>>;

/** Every kind's schema, by kind. */
export type Schemas = Readonly<Record<string, TableSchema>>;

type Fields = Readonly<Record<string, number | string | readonly number[]>>;

/** Finds the row index with this id by binary search, or -1: ids rise with insertion order. */
function indexOf(rows: readonly EntityRow[], id: number): number {
  let lo = 0;
  let hi = rows.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const at = rows[mid]!.id;
    if (at === id) return mid;
    if (at < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

/** Adds a row of `kind` with the next entity id, and returns the id. */
export function addEntity(world: WorldState, kind: string, fields: Fields): number {
  const id = world.nextEntityId;
  world.nextEntityId += 1;
  const row: EntityRow = { id };
  for (const [name, value] of Object.entries(fields))
    row[name] = Array.isArray(value) ? [...value] : (value as number | string);
  (world.entities[kind] ??= []).push(row);
  return id;
}

/** The row of `kind` with this id, or undefined. */
export function entityOf(world: WorldState, kind: string, id: number): EntityRow | undefined {
  const rows = world.entities[kind];
  return rows ? rows[indexOf(rows, id)] : undefined;
}

/** Removes the row of `kind` with this id; its id is never given out again. */
export function removeEntity(world: WorldState, kind: string, id: number): void {
  const rows = world.entities[kind];
  const at = rows ? indexOf(rows, id) : -1;
  if (at < 0) throw new Error(`No ${kind} ${id} to remove.`);
  rows!.splice(at, 1);
}

const isInt = (v: unknown): v is number => Number.isSafeInteger(v);

function fieldSound(type: FieldType, value: unknown, world: WorldState): boolean {
  switch (type) {
    case 'int':
      return isInt(value);
    case 'count':
      return isInt(value) && value >= 0;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'text':
      return typeof value === 'string';
    case 'entity':
      return isInt(value) && value >= 0 && value < world.nextEntityId;
    case 'event':
      return isInt(value) && value >= 0 && value < world.nextEventId;
    case 'events':
      return Array.isArray(value) && value.every((v) => fieldSound('event', v, world));
  }
}

/**
 * Why the entity tables do not fit `schemas`, or undefined when they do: every kind is declared,
 * every row has exactly its declared fields with sound values, ids rise and stay under the counter.
 */
export function tablesProblem(world: WorldState, schemas: Schemas): string | undefined {
  if (!isInt(world.nextEntityId) || world.nextEntityId < 1) return 'the entity counter is damaged';
  let last = 0;
  const seen = new Set<number>();
  for (const [kind, rows] of Object.entries(world.entities)) {
    const schema = schemas[kind];
    if (!schema) return `it has ${kind} rows, which this game does not know`;
    if (!Array.isArray(rows)) return `the ${kind} table is damaged`;
    const names = Object.keys(schema);
    last = 0;
    for (const row of rows) {
      const id = (row as { id?: unknown })?.id;
      if (!isInt(id) || id <= last || id >= world.nextEntityId || seen.has(id))
        return `a ${kind} has a bad id`;
      last = id;
      seen.add(id);
      if (Object.keys(row).length !== names.length + 1) return `${kind} ${id} has other fields`;
      for (const name of names)
        if (!fieldSound(schema[name]!, row[name], world))
          return `${kind} ${id}'s ${name} is not a sound ${schema[name]}`;
    }
  }
  return undefined;
}

/** Adds every ledger id the entity rows cite (`event` and `events` fields) to `into`. */
export function citedByEntities(world: WorldState, schemas: Schemas, into: Set<number>): void {
  for (const [kind, rows] of Object.entries(world.entities)) {
    const schema = schemas[kind];
    if (!schema) continue;
    const refs = Object.keys(schema).filter((f) => schema[f] === 'event' || schema[f] === 'events');
    if (!refs.length) continue;
    for (const row of rows)
      for (const f of refs) {
        const v = row[f];
        if (Array.isArray(v)) for (const id of v) into.add(id);
        else if (typeof v === 'number' && v > 0) into.add(v);
      }
  }
}
