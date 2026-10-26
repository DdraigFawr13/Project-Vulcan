// The lamp file's cross-references (src/engine/bees): bees months are calendar months, its job a job.
type Files = Readonly<Record<string, unknown>>;

export function checkBees(files: Files): string[] {
  const b = (
    files['lamp'] as {
      bees: {
        job: string;
        skep: { months: string[] };
        swarm: { months: string[] };
        harvest: { month: string };
      };
    }
  ).bees;
  const months = (files['calendar'] as { monthNames: string[] }).monthNames;
  const jobs = (files['jobs'] as { id: string }[]).map((j) => j.id);
  const errors: string[] = [];
  const month = (m: string, at: string) => {
    if (!months.includes(m)) errors.push(`lamp.bees.${at}: "${m}" is no month`);
  };
  b.skep.months.forEach((m, k) => month(m, `skep.months[${k}]`));
  b.swarm.months.forEach((m, k) => month(m, `swarm.months[${k}]`));
  month(b.harvest.month, 'harvest.month');
  if (!jobs.includes(b.job)) errors.push(`lamp.bees.job: "${b.job}" is no job`);
  return errors;
}
