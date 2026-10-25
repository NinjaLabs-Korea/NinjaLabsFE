// Process-scan rules of the integration harness reaper (integration/lib/reaper.mjs), documented as tests.
// Where to change: which processes count as a leftover of a run -> runDirOf() in the reaper; this file must follow.
import { describe, expect, it } from 'vitest';
import * as reaper from '../../integration/lib/reaper.mjs';

const { runDirOf, parsePs, parseLsofCwd, findStrayProcesses, reapStale } = reaper as {
  reapStale: (o: { tmp: string }) => string[];
  runDirOf: (info: { pid: number; cwd?: string; command?: string }, roots: string[]) => string | null;
  parsePs: (out: string) => { pid: number; pgid: number; command: string }[];
  parseLsofCwd: (out: string) => Map<number, string>;
  findStrayProcesses: (o: { tmp: string; skipDirs?: string[]; only?: string | null; processes: unknown[] }) => { pid: number; dir: string }[];
};

const ROOTS = ['/var/folders/ab/T', '/private/var/folders/ab/T'];

describe('runDirOf: what counts as a process of a harness run', () => {
  it('matches by cwd, even when the run dir has been deleted (Linux marks it "(deleted)")', () => {
    expect(runDirOf({ pid: 1, cwd: '/private/var/folders/ab/T/ninja-it-EroaWr/fe' }, ROOTS)).toBe('/private/var/folders/ab/T/ninja-it-EroaWr');
    expect(runDirOf({ pid: 1, cwd: '/var/folders/ab/T/ninja-it-EroaWr/fe (deleted)' }, ROOTS)).toBe('/var/folders/ab/T/ninja-it-EroaWr');
  });
  it('matches by command line (Chrome --user-data-dir, tls proxy cert dir, watchdog argument)', () => {
    expect(runDirOf({ pid: 1, cwd: '/', command: 'chrome --user-data-dir=/var/folders/ab/T/ninja-it-x1/chrome about:blank' }, ROOTS)).toBe('/var/folders/ab/T/ninja-it-x1');
  });
  it('ignores unrelated processes and look-alike paths', () => {
    expect(runDirOf({ pid: 1, cwd: '/Users/me/NinjaLabsFE', command: 'node next start' }, ROOTS)).toBeNull();
    expect(runDirOf({ pid: 1, cwd: '/var/folders/ab/T/other-ninja-it-x/fe' }, ROOTS)).toBeNull();
    expect(runDirOf({ pid: 1, cwd: '/tmp/ninja-it-x/fe' }, ROOTS)).toBeNull(); // different tmp root
    expect(runDirOf({ pid: 1 }, ROOTS)).toBeNull();
  });
});

describe('process-table parsers', () => {
  it('parses ps output', () => {
    expect(parsePs('  12   12 node a b\n 345  12 /usr/bin/x --y=1\n')).toEqual([
      { pid: 12, pgid: 12, command: 'node a b' },
      { pid: 345, pgid: 12, command: '/usr/bin/x --y=1' },
    ]);
  });
  it('parses lsof -Fpn output', () => {
    const m = parseLsofCwd('p12\nfcwd\nn/a/b\np99\nfcwd\nn/c d\n');
    expect(m.get(12)).toBe('/a/b');
    expect(m.get(99)).toBe('/c d');
  });
});

describe('findStrayProcesses', () => {
  const procs = [
    { pid: 10, pgid: 10, command: 'next-server', cwd: '/var/folders/ab/T/ninja-it-dead/fe' },
    { pid: 11, pgid: 11, command: 'next-server', cwd: '/var/folders/ab/T/ninja-it-live/fe' },
    { pid: 12, pgid: 12, command: 'vim', cwd: '/home/me' },
    { pid: process.pid, pgid: 1, command: 'self', cwd: '/var/folders/ab/T/ninja-it-dead/self' },
  ];
  it('finds orphans of a dir that no longer exists, skips live runs and itself', () => {
    const found = findStrayProcesses({ tmp: '/var/folders/ab/T', skipDirs: ['ninja-it-live'], processes: procs });
    expect(found.map((p) => p.pid)).toEqual([10]);
  });
  it('can be restricted to one run dir', () => {
    expect(findStrayProcesses({ tmp: '/var/folders/ab/T', only: 'ninja-it-live', processes: procs }).map((p) => p.pid)).toEqual([11]);
  });
});

// Real processes: an orphan whose run dir is already deleted (the field bug: next-server with cwd in a deleted ninja-it-*/fe).
describe('reapStale with a deleted run dir', () => {
  it('kills a process whose cwd is inside a deleted ninja-it-* dir and leaves a live harness run alone', async () => {
    const { spawn } = await import('node:child_process');
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reaper-scan-')));
    const orphanDir = path.join(root, 'ninja-it-gone', 'fe');
    fs.mkdirSync(orphanDir, { recursive: true });
    const liveDir = path.join(root, 'ninja-it-live');
    fs.mkdirSync(liveDir);
    fs.writeFileSync(path.join(liveDir, 'pids.json'), JSON.stringify({ harnessPid: process.pid, groups: [] }));
    const hold = 'setInterval(() => {}, 1000)';
    const orphan = spawn(process.execPath, ['-e', hold], { cwd: orphanDir, stdio: 'ignore' });
    const bystander = spawn(process.execPath, ['-e', hold], { cwd: liveDir, stdio: 'ignore' });
    try {
      await new Promise((r) => setTimeout(r, 300));
      fs.rmSync(path.join(root, 'ninja-it-gone'), { recursive: true, force: true });
      const reaped = reapStale({ tmp: root });
      await new Promise((r) => setTimeout(r, 300));
      expect(reaped).toEqual([path.join(root, 'ninja-it-gone')]);
      expect(orphan.exitCode !== null || orphan.signalCode !== null).toBe(true);
      expect(bystander.exitCode).toBeNull();
      expect(bystander.signalCode).toBeNull();
    } finally {
      orphan.kill('SIGKILL');
      bystander.kill('SIGKILL');
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 20_000);
});
