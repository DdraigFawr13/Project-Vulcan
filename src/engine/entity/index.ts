// Public surface of the entity tables: rows by kind with one id counter, and their generic check.
export { addEntity, citedByEntities, entityOf, removeEntity, tablesProblem } from './tables.ts';
export type { FieldType, Schemas, TableSchema } from './tables.ts';
