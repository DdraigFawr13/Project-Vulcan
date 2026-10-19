// The build's version stamp, shown in the top bar so Morgan can see which build is running and
// notice when it changes. It is made when Vite builds: the phase is the newest docs/phases spec, the
// number is the newest merged PR's, and the hash and date say exactly which build it is.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

export interface BuildVersion {
  /** Short label for the bar, such as "v4.64". */
  label: string;
  /** Short commit hash, or "local" outside git. */
  commit: string;
  /** ISO time the build ran. */
  builtAt: string;
}

/** The label from the phase and commit subjects (newest first); "v4.dev" with no PR number. */
export function versionLabel(phase: number, subjects: readonly string[]): string {
  for (const subject of subjects) {
    const pr = /#(\d+)/.exec(subject)?.[1];
    if (pr) return `v${phase}.${pr}`;
  }
  return `v${phase}.dev`;
}

function git(args: string[]): string {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/** Reads the repository (Vercel's commit variables first, as its build may have no history). */
export function buildVersion(root: string, env = process.env, now = new Date()): BuildVersion {
  const phases = readdirSync(`${root}/docs/phases`)
    .map((f) => Number(/^PHASE_(\d+)\.md$/.exec(f)?.[1] ?? -1))
    .filter((n) => n >= 0);
  const phase = Math.max(0, ...phases);
  const subjects = [
    env['VERCEL_GIT_COMMIT_MESSAGE'] ?? '',
    ...git(['log', '-30', '--format=%s']).split('\n'),
  ];
  const sha = env['VERCEL_GIT_COMMIT_SHA'] || git(['rev-parse', 'HEAD']);
  return {
    label: versionLabel(phase, subjects),
    commit: sha ? sha.slice(0, 7) : 'local',
    builtAt: now.toISOString(),
  };
}
