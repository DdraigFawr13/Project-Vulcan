// The defiance file's cross-references (src/engine/defy): every Punishment setting's `punish`
// (laws.json) names a sentence in defy.json `punish`, and each sentence does something.
type Files = Readonly<Record<string, unknown>>;

interface Sentence {
  day?: string;
  memory?: string;
  leave?: boolean;
}

export function checkPunish(files: Files): string[] {
  const sentences = (files['defy'] as { punish: Record<string, Sentence> }).punish;
  const laws = (files['laws'] as { laws: { id: string; settings: { punish?: string }[] }[] }).laws;
  const errors: string[] = [];
  for (const law of laws)
    for (const s of law.settings)
      if (s.punish !== undefined && !(s.punish in sentences))
        errors.push(`laws.${law.id}: punish "${s.punish}" is no defy.json sentence`);
  for (const [id, s] of Object.entries(sentences))
    if (!s.day && !s.memory && !s.leave) errors.push(`defy.punish.${id}: does nothing`);
  return errors;
}
