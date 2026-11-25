// The asks file's cross-references (6C Slice 3, V-225): each ask names either a tool kind or goods
// (items or goods, `|` between several), a count or a share, and a furniture quality word; the
// lord's asks cover every temper, the village asks name troubles strangers carry, the shrine's
// cover every faith's first sacred tag, and gifts and memories exist.
type Files = Readonly<Record<string, unknown>>;

interface Want {
  tool?: string;
  good?: string;
  count?: number;
  share?: number;
  quality?: string;
}

interface Asks {
  lord: { asks: (Want & { temper: string })[] };
  village: Record<string, Want>;
  gifts: Record<string, { kind: string }>;
  shrine: { done: string; passed: string; asks: Record<string, Want> };
  guests: { against: string };
  dreams: { backed: string; unbacked: string; house: Want; skills: Record<string, Want> };
}

/** The checks every ask shares. */
function wantErrors(files: Files, at: string, a: Want): string[] {
  const tools = (files['tools'] as { kinds: { id: string }[] }).kinds.map((k) => k.id);
  const items = files['items'] as { id: string; good: string }[];
  const goods = new Set(items.flatMap((i) => [i.id, i.good]));
  const words = (
    files['buildings'] as { furniture: { quality: { id: string }[] } }
  ).furniture.quality.map((q) => q.id);
  const errors: string[] = [];
  if (!a.tool === !a.good) errors.push(`${at}: give a tool or a good, not both`);
  if (a.tool && !tools.includes(a.tool)) errors.push(`${at}.tool: "${a.tool}" is no tool kind`);
  for (const g of a.good ? a.good.split('|') : [])
    if (!goods.has(g)) errors.push(`${at}.good: "${g}" is no item or good`);
  if (!a.count === !a.share) errors.push(`${at}: give a count or a share, not both`);
  if (a.quality && !words.includes(a.quality))
    errors.push(`${at}.quality: "${a.quality}" is no quality word`);
  return errors;
}

export function checkAsks(files: Files): string[] {
  const asks = files['asks'] as Asks;
  const tempers = Object.keys((files['lord'] as { tempers: Record<string, number> }).tempers);
  const kinds = (files['strangers'] as { kinds: { id: string }[] }).kinds.map((k) => k.id);
  const faiths = (files['faiths'] as { defs: { id: string; sacred: string[] }[] }).defs;
  const items = (files['items'] as { id: string }[]).map((i) => i.id);
  const memories = (files['memories'] as { id: string }[]).map((m) => m.id);
  const errors: string[] = [];
  asks.lord.asks.forEach((a, k) => {
    const at = `asks.lord.asks[${k}]`;
    if (!tempers.includes(a.temper)) errors.push(`${at}.temper: "${a.temper}" is no temper`);
    errors.push(...wantErrors(files, at, a));
  });
  for (const t of tempers)
    if (!asks.lord.asks.some((a) => a.temper === t))
      errors.push(`asks.lord.asks: no ask for temper "${t}"`);
  for (const [kind, a] of Object.entries(asks.village)) {
    if (!kinds.includes(kind)) errors.push(`asks.village.${kind}: no such stranger kind`);
    errors.push(...wantErrors(files, `asks.village.${kind}`, a));
  }
  for (const [kind, g] of Object.entries(asks.gifts))
    if (!items.includes(g.kind)) errors.push(`asks.gifts.${kind}.kind: "${g.kind}" is no item`);
  if (!asks.gifts['else']) errors.push('asks.gifts: give an "else" gift');
  for (const [tag, a] of Object.entries(asks.shrine.asks))
    errors.push(...wantErrors(files, `asks.shrine.asks.${tag}`, a));
  for (const f of faiths)
    if (f.sacred[0] && !asks.shrine.asks[f.sacred[0]])
      errors.push(`asks.shrine.asks: no ask for "${f.sacred[0]}" (faith ${f.id})`);
  errors.push(...wantErrors(files, 'asks.dreams.house', asks.dreams.house));
  for (const [skill, a] of Object.entries(asks.dreams.skills))
    errors.push(...wantErrors(files, `asks.dreams.skills.${skill}`, a));
  const mems = [asks.shrine.done, asks.shrine.passed, asks.guests.against];
  for (const m of [...mems, asks.dreams.backed, asks.dreams.unbacked])
    if (!memories.includes(m)) errors.push(`asks: "${m}" is no memory`);
  return errors;
}
