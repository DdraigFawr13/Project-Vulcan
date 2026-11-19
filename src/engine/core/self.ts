// What the self system reads from content (self.json, P6.4, V-146, V-156).

export interface RoleDef {
  id: string;
  /** "the provider" */
  name: string;
  traits: Readonly<Record<string, number>>;
  memories: Readonly<Record<string, number>>;
  /** A point for each `skillStep` levels of the best of these skills. */
  skills?: readonly string[];
  beliefs?: Readonly<Record<string, number>>;
  newcomer?: number;
  refused?: number;
}

export interface AmbitionDef {
  id: string;
  /** "to make a masterwork in {skill}" */
  text: string;
  kind: 'master' | 'learn' | 'house';
  skills?: readonly string[];
  from?: number;
  under?: number;
  to?: number;
}

export interface SelfDef {
  at: number;
  most: number;
  keep: number;
  skillStep: number;
  hour: number;
  roles: readonly RoleDef[];
  ambition: { checkDays: number; chance: number; every: number; memory: string };
  ambitions: readonly AmbitionDef[];
}

export interface SelfDefs {
  self: SelfDef;
}
