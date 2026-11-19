export type Measured = { name: string; line: number; lines: number; complexity: number };
export type Shape = { counts: Record<string, number>; modules: Record<string, number> };
export function measureFunctions(text: string): Measured[];
export function compare(now: Shape, base: Shape): { rose: string[]; fell: string[] };
