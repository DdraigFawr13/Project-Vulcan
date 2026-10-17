// A small schema language for content files: each spec checks a value at run time and gives
// its TypeScript type through `Infer`, so a content shape is written once. Pure (V-006).

export type RefTarget =
  | 'races'
  | 'cultures'
  | 'schools'
  | 'abilities'
  | 'creatures'
  | 'items'
  | 'biomes'
  | 'needs'
  | 'traits'
  | 'memories'
  | 'jobs'
  | 'conditions'
  | 'faiths'
  | 'tiers'
  | 'terrain';

export interface StrSpec<V extends string = string> {
  readonly k: 'str';
  readonly oneOf?: readonly V[];
  readonly ref?: RefTarget;
}
export interface NumSpec {
  readonly k: 'num';
  readonly min?: number;
  readonly max?: number;
}
export interface BoolSpec {
  readonly k: 'bool';
}
export interface ListSpec<T extends Spec = Spec> {
  readonly k: 'list';
  readonly of: T;
  readonly len?: number;
}
export interface ObjSpec<F extends Fields = Fields> {
  readonly k: 'obj';
  readonly fields: F;
}
export interface MapSpec<T extends Spec = Spec> {
  readonly k: 'map';
  readonly of: T;
  readonly keyRef?: RefTarget;
}
export interface AnySpec {
  readonly k: 'any';
}
export interface OptSpec<T extends Spec = Spec> {
  readonly k: 'opt';
  readonly of: T;
}
export type Spec = StrSpec | NumSpec | BoolSpec | ListSpec | ObjSpec | MapSpec | AnySpec | OptSpec;
export type Fields = { readonly [key: string]: Spec };

export const str = (o: Omit<StrSpec, 'k'> = {}): StrSpec => ({ k: 'str', ...o });
export const oneOf = <const V extends string>(...values: V[]): StrSpec<V> => ({
  k: 'str',
  oneOf: values,
});
export const ref = (target: RefTarget): StrSpec => ({ k: 'str', ref: target });
export const num = (o: Omit<NumSpec, 'k'> = {}): NumSpec => ({ k: 'num', ...o });
export const bool = (): BoolSpec => ({ k: 'bool' });
export const list = <T extends Spec>(of: T, len?: number): ListSpec<T> =>
  len === undefined ? { k: 'list', of } : { k: 'list', of, len };
export const obj = <F extends Fields>(fields: F): ObjSpec<F> => ({ k: 'obj', fields });
export const map = <T extends Spec>(of: T, keyRef?: RefTarget): MapSpec<T> =>
  keyRef === undefined ? { k: 'map', of } : { k: 'map', of, keyRef };
export const any = (): AnySpec => ({ k: 'any' });
export const opt = <T extends Spec>(of: T): OptSpec<T> => ({ k: 'opt', of });
/** A number pair such as `[min, max]`. */
export const range = (): ListSpec<NumSpec> => list(num(), 2);

type RequiredKeys<F extends Fields> = { [K in keyof F]: F[K] extends OptSpec ? never : K }[keyof F];
type OptionalKeys<F extends Fields> = Exclude<keyof F, RequiredKeys<F>>;
type InferFields<F extends Fields> = { readonly [K in RequiredKeys<F>]: Infer<F[K]> } & {
  readonly [K in OptionalKeys<F>]?: F[K] extends OptSpec<infer T> ? Infer<T> : never;
};
type InferPlain<S> =
  S extends StrSpec<infer V>
    ? V
    : S extends NumSpec
      ? number
      : S extends BoolSpec
        ? boolean
        : unknown;

/** The TypeScript type of the values a spec accepts. */
export type Infer<S> =
  S extends ListSpec<infer T>
    ? readonly Infer<T>[]
    : S extends ObjSpec<infer F>
      ? InferFields<F>
      : S extends MapSpec<infer T>
        ? { readonly [key: string]: Infer<T> }
        : S extends OptSpec<infer T>
          ? Infer<T> | undefined
          : InferPlain<S>;

/** A reference found while checking, resolved once every file's ids are known. */
export interface RefUse {
  readonly path: string;
  readonly target: RefTarget;
  readonly value: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Checks `value` against `spec`, adding one line per problem to `errors`. */
export function check(
  spec: Spec,
  value: unknown,
  path: string,
  errors: string[],
  refs: RefUse[],
): void {
  switch (spec.k) {
    case 'opt':
      if (value !== undefined) check(spec.of, value, path, errors, refs);
      return;
    case 'any':
      return;
    case 'str':
      if (typeof value !== 'string') errors.push(`${path}: expected text, got ${show(value)}`);
      else if (spec.oneOf && !(spec.oneOf as readonly string[]).includes(value))
        errors.push(`${path}: "${value}" is not one of ${spec.oneOf.join(', ')}`);
      else if (spec.ref) refs.push({ path, target: spec.ref, value });
      return;
    case 'num':
      if (typeof value !== 'number' || !Number.isFinite(value))
        errors.push(`${path}: expected a number, got ${show(value)}`);
      else if (spec.min !== undefined && value < spec.min)
        errors.push(`${path}: ${value} is below ${spec.min}`);
      else if (spec.max !== undefined && value > spec.max)
        errors.push(`${path}: ${value} is above ${spec.max}`);
      return;
    case 'bool':
      if (typeof value !== 'boolean')
        errors.push(`${path}: expected true or false, got ${show(value)}`);
      return;
    case 'list':
      if (!Array.isArray(value)) errors.push(`${path}: expected a list, got ${show(value)}`);
      else if (spec.len !== undefined && value.length !== spec.len)
        errors.push(`${path}: expected ${spec.len} items, got ${value.length}`);
      else value.forEach((v, i) => check(spec.of, v, `${path}[${label(v, i)}]`, errors, refs));
      return;
    case 'map':
      if (!isRecord(value)) errors.push(`${path}: expected a set of named values`);
      else
        for (const [key, v] of Object.entries(value)) {
          if (spec.keyRef) refs.push({ path: `${path}.${key}`, target: spec.keyRef, value: key });
          check(spec.of, v, `${path}.${key}`, errors, refs);
        }
      return;
    case 'obj':
      if (!isRecord(value)) {
        errors.push(`${path}: expected an entry, got ${show(value)}`);
        return;
      }
      for (const [key, field] of Object.entries(spec.fields)) {
        if (value[key] === undefined && field.k !== 'opt')
          errors.push(`${path}.${key}: missing required field`);
        else check(field, value[key], `${path}.${key}`, errors, refs);
      }
      for (const key of Object.keys(value))
        if (!Object.hasOwn(spec.fields, key)) errors.push(`${path}.${key}: unknown field`);
      return;
  }
}

// List items are named by their id where they have one, so errors read `cultures[gwerin]`.
function label(v: unknown, i: number): string {
  return isRecord(v) && typeof v['id'] === 'string' ? v['id'] : String(i);
}

function show(v: unknown): string {
  if (v === undefined) return 'nothing';
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'a list';
  return typeof v === 'object' ? 'an entry' : JSON.stringify(v);
}
