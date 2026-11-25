import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOOL, decide, stampFile, treeState, writeStamp } from '../ready-gate.mjs';

const HEAD = 'a'.repeat(40);
const ready = (repo = 'Project-Vulcan', draft: boolean | undefined = false) => ({
  tool_name: TOOL,
  tool_input: { owner: 'DdraigFawr13', repo, pullNumber: 1, draft },
});

describe('ready-gate decide', () => {
  it('lets the call through when check:all passed on HEAD and the tree is clean', () => {
    expect(decide(ready(), { stamp: { head: HEAD }, head: HEAD, dirty: false })).toBeNull();
  });

  it('denies with no stamp, a stamp for another commit, or uncommitted changes', () => {
    expect(decide(ready(), { stamp: null, head: HEAD, dirty: false })).toMatch(
      /no `npm run check:all` pass/,
    );
    expect(decide(ready(), { stamp: { head: 'b'.repeat(40) }, head: HEAD, dirty: false })).toMatch(
      /was on bbbbbbbbbbbb, but HEAD is aaaaaaaaaaaa/,
    );
    expect(decide(ready(), { stamp: { head: HEAD }, head: HEAD, dirty: true })).toMatch(
      /uncommitted changes/,
    );
  });

  it('ignores other repos, drafts and other tools', () => {
    const none = { stamp: null, head: HEAD, dirty: true };
    expect(decide(ready('AI-Master-Instructions'), none)).toBeNull();
    expect(decide(ready('Project-Vulcan', true), none)).toBeNull();
    expect(
      decide({ tool_name: TOOL, tool_input: { repo: 'Project-Vulcan', title: 'x' } }, none),
    ).toBeNull();
    expect(
      decide({ tool_name: 'Bash', tool_input: { repo: 'project-vulcan', draft: false } }, none),
    ).toBeNull();
  });
});

describe('ready-gate stamp', () => {
  const sh = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const repo = () => {
    const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'ready-gate-')));
    sh(dir, 'init', '--quiet');
    writeFileSync(path.join(dir, 'a.txt'), 'a\n');
    sh(dir, 'add', '-A');
    sh(
      dir,
      '-c',
      'user.email=a@example.com',
      '-c',
      'user.name=A',
      'commit',
      '--quiet',
      '-m',
      'start',
    );
    return dir;
  };

  it('writes a stamp for a clean HEAD and refuses a dirty tree', () => {
    const dir = repo();
    expect(writeStamp(dir)).toMatch(/^ready stamp written/);
    const stamp = JSON.parse(readFileSync(stampFile(dir), 'utf8'));
    expect(decide(ready(), { stamp, ...treeState(dir) })).toBeNull();
    writeFileSync(path.join(dir, 'a.txt'), 'b\n');
    expect(writeStamp(dir)).toMatch(/no ready stamp was written/);
    expect(decide(ready(), { stamp, ...treeState(dir) })).toMatch(/uncommitted changes/);
  });

  it('the hook prints a deny for a ready call and nothing for a draft call', () => {
    const script = path.resolve(__dirname, '../ready-gate.mjs');
    const call = (input: object) =>
      spawnSync(process.execPath, [script], { input: JSON.stringify(input), encoding: 'utf8' })
        .stdout;
    const out = call(ready());
    // In this checkout there may or may not be a stamp for HEAD; either way the output is valid.
    if (out) expect(JSON.parse(out).hookSpecificOutput.permissionDecision).toBe('deny');
    expect(call(ready('Project-Vulcan', true))).toBe('');
  });
});
