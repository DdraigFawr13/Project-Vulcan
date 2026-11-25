export const TOOL: string;
export type Stamp = { head: string; ts?: string } | null;
export function stampFile(cwd?: string): string;
export function treeState(cwd?: string): { head: string; dirty: boolean };
export function writeStamp(cwd?: string): string;
export function decide(
  input: { tool_name?: string; tool_input?: Record<string, unknown> } | null,
  state: { stamp: Stamp; head: string; dirty: boolean },
): string | null;
