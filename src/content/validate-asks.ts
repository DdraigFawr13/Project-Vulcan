// The asks file's cross-references (6C Slice 3, V-225): each lord's ask names a temper, either a
// tool kind or a good (not both), a count or a share, and a furniture quality word.
type Files = Readonly<Record<string, unknown>>;

interface LordAsk {
  temper: string;
  tool?: string;
  good?: string;
  count?: number;
  share?: number;
  quality?: string;
}

export function checkAsks(files: Files): string[] {
  const asks = (files['asks'] as { lord: { asks: LordAsk[] } }).lord.asks;
  const tempers = Object.keys((files['lord'] as { tempers: Record<string, number> }).tempers);
  const tools = (files['tools'] as { kinds: { id: string }[] }).kinds.map((k) => k.id);
  const items = files['items'] as { id: string; good: string }[];
  const goods = new Set(items.flatMap((i) => [i.id, i.good]));
  const words = (
    files['buildings'] as { furniture: { quality: { id: string }[] } }
  ).furniture.quality.map((q) => q.id);
  const errors: string[] = [];
  asks.forEach((a, k) => {
    const at = `asks.lord.asks[${k}]`;
    if (!tempers.includes(a.temper)) errors.push(`${at}.temper: "${a.temper}" is no temper`);
    if (!a.tool === !a.good) errors.push(`${at}: give a tool or a good, not both`);
    if (a.tool && !tools.includes(a.tool)) errors.push(`${at}.tool: "${a.tool}" is no tool kind`);
    if (a.good && !goods.has(a.good)) errors.push(`${at}.good: "${a.good}" is no item or good`);
    if (!a.count === !a.share) errors.push(`${at}: give a count or a share, not both`);
    if (a.quality && !words.includes(a.quality))
      errors.push(`${at}.quality: "${a.quality}" is no quality word`);
  });
  for (const t of tempers)
    if (!asks.some((a) => a.temper === t)) errors.push(`asks.lord.asks: no ask for temper "${t}"`);
  return errors;
}
