// What the tavern (engine inn) reads from content (tavern.json, 6B Bundle 5, P6.12, V-188).

export interface TavernDef {
  build: {
    name: string;
    start: number;
    size: string;
    names: readonly string[];
    wants: readonly { kind: string; count: number }[];
  };
  brew: {
    job: string;
    tub: string;
    cask: string;
    minutes: number;
    skilled: number;
    cups: number;
    days: number;
    recipes: readonly { drink: string; from: readonly string[]; count: number }[];
  };
  stock: string;
  evening: {
    go: number;
    traits: Readonly<Record<string, number>>;
    cups: number;
    low: number;
    lowCups: number;
    leave: number;
    cup: string;
  };
  keeper: { job: string; trait: string; hears: number };
  bend: number;
  brawl: {
    chance: number;
    trait: string;
    kinds: readonly string[];
    parts: readonly string[];
    what: string;
    memory: string;
  };
  hungOver: { after: number; memory: string; idle: number; until: number };
  bard: {
    job: string;
    skill: string;
    trait: string;
    evenings: number;
    practise: number;
    heard: readonly string[];
    perHeard: number;
  };
}

export interface TavernDefs {
  tavern: TavernDef;
}
