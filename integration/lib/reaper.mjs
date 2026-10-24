// Teardown of a (possibly dead) harness run, driven only by the run's temp dir: `<dir>/pids.json` records the harness
// pid, the detached child process groups and the Postgres data directory as soon as they exist. Used by the harness's
// own cleanup, the detached watchdog (lib/watchdog.mjs) and `run-all.mjs --reap` / the startup reaper.
//
// pids.json alone is not enough: a process that escaped its recorded group (or was spawned between the spawn and the
// pids.json write) keeps running after its temp dir is gone. So teardown ALSO scans the process table for anything whose cwd
// or command line points into `<tmp>/ninja-it-*` (findStrayProcesses) and kills it. Where to change what:
//   - which processes count as "ours"      -> runDirOf() (pure, pinned by src/test/integration-reaper-scan.test.ts)
//   - how the process table is read        -> listProcesses() (ps + lsof on macOS, ps + /proc on Linux)
//   - the temp dir is deleted only when everything is confirmed dead -> reapDir()
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const TMP_PREFIX = 'ninja-it-';
export const PIDS_FILE = 'pids.json';

/** Live process table rows { pid, pgid, stat } (zombies included: see below). */
const psStat = () => {
  try {
    return execFileSync('ps', ['-axo', 'pid=,pgid=,stat='], { encoding: 'utf8', maxBuffer: 16 << 20 })
      .split('\n').map((l) => /^\s*(\d+)\s+(\d+)\s+(\S+)/.exec(l)).filter(Boolean).map((m) => ({ pid: Number(m[1]), pgid: Number(m[2]), stat: m[3] }));
  } catch { return null; }
};
/**
 * A zombie (state Z) is dead for our purposes. This matters inside the harness itself: it waits synchronously while its
 * children die, so their exit is not reaped yet and kill(pid, 0) would report them alive until the process exits.
 */
export const alive = (pid) => {
  try { process.kill(pid, 0); } catch (e) { return e.code === 'EPERM'; }
  const row = psStat()?.find((r) => r.pid === pid);
  return !row || !row.stat.startsWith('Z');
};
const groupAlive = (pgid) => {
  try { process.kill(-pgid, 0); } catch (e) { if (e.code !== 'EPERM') return false; }
  const rows = psStat();
  return !rows || rows.some((r) => r.pgid === pgid && !r.stat.startsWith('Z'));
};
const isPostgres = (pid) => {
  try { return /postgres|postmaster/.test(execFileSync('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8' })); } catch { return false; }
};
const sleepSync = (s) => { try { execFileSync('sleep', [String(s)]); } catch { /* interrupted */ } };

export function readPids(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, PIDS_FILE), 'utf8')); } catch { return null; }
}
/** Merges `patch` into `<dir>/pids.json` (atomic rename, so a reaper never reads a half-written file). */
export function writePids(dir, patch) {
  const next = { harnessPid: process.pid, groups: [], ...(readPids(dir) ?? {}), ...patch };
  const tmp = path.join(dir, `${PIDS_FILE}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, path.join(dir, PIDS_FILE));
  return next;
}

// ---------------------------------------------------------------- process-table scan (works without the temp dir)
const safeRealpath = (p) => { try { return fs.realpathSync(p); } catch { return p; } };
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Directories that can hold run dirs: tmpdir and its realpath (macOS: /var/folders/.. is really /private/var/folders/..). */
export const tmpRoots = (tmp = os.tmpdir()) => [...new Set([tmp, safeRealpath(tmp)])];

/**
 * Pure matcher: the absolute run dir (`<root>/ninja-it-XXXX`) that `info.cwd` or `info.command` points into, or null.
 * A cwd of a deleted dir counts (Linux appends " (deleted)"). `info` = { pid, cwd?, command? }.
 */
export function runDirOf(info, roots, prefix = TMP_PREFIX) {
  for (const text of [info.cwd, info.command]) {
    if (!text) continue;
    const clean = text.replace(/ \(deleted\)$/, '');
    for (const root of roots) {
      const m = new RegExp(`(?<![^\\s='":])${escapeRe(root.replace(/\/+$/, ''))}/(${escapeRe(prefix)}[^/\\s]+)`).exec(clean);
      if (m) return `${root.replace(/\/+$/, '')}/${m[1]}`;
    }
  }
  return null;
}

/** Parses `ps -axo pid=,pgid=,command=` output. */
export function parsePs(out) {
  const rows = [];
  for (const line of out.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    if (m) rows.push({ pid: Number(m[1]), pgid: Number(m[2]), command: m[3] });
  }
  return rows;
}
/** Parses `lsof -a -d cwd -Fpn` output into Map<pid, cwd>. */
export function parseLsofCwd(out) {
  const cwds = new Map();
  let pid = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1));
    else if (line.startsWith('n') && pid) cwds.set(pid, line.slice(1));
  }
  return cwds;
}
const run = (cmd, args) => {
  try { return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (e) { return e.stdout ? String(e.stdout) : ''; } // lsof exits 1 when some processes are not inspectable
};
/** Every visible process as { pid, pgid, command, cwd }. cwd via lsof (macOS) or /proc (Linux). */
export function listProcesses() {
  const rows = parsePs(run('ps', ['-axo', 'pid=,pgid=,command=']));
  const cwds = process.platform === 'linux' ? new Map() : parseLsofCwd(run('lsof', ['-a', '-d', 'cwd', '-Fpn', '-w']));
  for (const r of rows) {
    if (process.platform === 'linux') { try { r.cwd = fs.readlinkSync(`/proc/${r.pid}/cwd`); } catch { /* gone / not ours */ } }
    else r.cwd = cwds.get(r.pid);
  }
  return rows;
}

/**
 * Processes (other than this one and its parent) that belong to some run dir, whether or not that dir still exists.
 * `skipDirs` = basenames of run dirs that must be left alone (live harness). `only` = a basename to restrict to.
 */
export function findStrayProcesses({ tmp = os.tmpdir(), skipDirs = [], only = null, processes = listProcesses() } = {}) {
  const roots = tmpRoots(tmp);
  const found = [];
  for (const p of processes) {
    if (p.pid === process.pid || p.pid === process.ppid) continue;
    const dir = runDirOf(p, roots);
    if (!dir) continue;
    const name = path.basename(dir);
    if (skipDirs.includes(name) || (only && name !== only)) continue;
    found.push({ ...p, dir });
  }
  return found;
}

/** SIGTERM, wait up to 3s, SIGKILL; returns the pids still alive afterwards. */
export function killProcesses(pids, { log = () => {} } = {}) {
  for (const pid of pids) { try { process.kill(pid, 'SIGTERM'); } catch { /* gone */ } }
  const deadline = Date.now() + 3000;
  while (pids.some(alive) && Date.now() < deadline) sleepSync(0.2);
  for (const pid of pids) {
    if (!alive(pid)) continue;
    try { process.kill(pid, 'SIGKILL'); log(`  stray ${pid} killed`); } catch { /* gone */ }
  }
  sleepSync(0.2);
  return pids.filter(alive);
}

// ---------------------------------------------------------------- teardown
/**
 * Stops the run's Postgres (immediate), kills every recorded process group that is still alive, then kills any remaining
 * process whose cwd/command line points into this run dir (even if the dir no longer exists).
 * Returns { did, survivors } - `survivors` are pids that would not die; callers must NOT delete the dir while any remain.
 */
export function stopServices(dir, { log = () => {}, tmp = path.dirname(dir) } = {}) {
  const pids = readPids(dir) ?? {};
  const did = [];
  const pgData = pids.pgData ?? path.join(dir, 'pg');
  const pidFile = path.join(pgData, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    const pmPid = Number(fs.readFileSync(pidFile, 'utf8').split('\n')[0]);
    if (pmPid && alive(pmPid) && isPostgres(pmPid)) { // a recycled pid must never be killed
      const pgCtl = pids.pgBin ? path.join(pids.pgBin, 'pg_ctl') : 'pg_ctl';
      try { execFileSync(pgCtl, ['-D', pgData, 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' }); did.push(`postgres ${pmPid} stopped`); }
      catch { try { process.kill(pmPid, 'SIGKILL'); did.push(`postgres ${pmPid} killed`); } catch { /* gone */ } }
    }
  }
  const groups = pids.groups ?? [];
  for (const pgid of groups) {
    if (!groupAlive(pgid)) continue;
    try { process.kill(-pgid, 'SIGTERM'); } catch { /* gone */ }
  }
  const deadline = Date.now() + 3000;
  while (groups.some(groupAlive) && Date.now() < deadline) sleepSync(0.2);
  for (const pgid of groups) {
    if (!groupAlive(pgid)) continue;
    try { process.kill(-pgid, 'SIGKILL'); did.push(`group ${pgid} killed`); } catch { /* gone */ }
  }
  // Safety net for anything that left its group or was spawned before it could be recorded.
  const strays = findStrayProcesses({ tmp, only: path.basename(dir) });
  let survivors = [];
  if (strays.length) {
    did.push(...strays.map((p) => `stray ${p.pid} (${p.command.slice(0, 60)})`));
    survivors = killProcesses(strays.map((p) => p.pid), { log });
  }
  for (const g of groups) if (groupAlive(g)) survivors.push(-g);
  for (const d of did) log(`  ${d}`);
  return { did, survivors };
}

/** Stops a run's processes, then deletes its dir ONLY if every one of them is confirmed dead. Returns true when deleted. */
export function reapDir(dir, { log = () => {}, keep = false } = {}) {
  const { survivors } = stopServices(dir, { log });
  if (survivors.length) { log(`  NOT deleting ${dir}: still running ${survivors.join(', ')}`); return false; }
  if (!keep && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

/**
 * Reaps every `ninja-it-*` dir under tmpdir whose harness is gone, then any stray process still pointing into a run dir that
 * has no live harness (the dir may already be deleted). Dirs of a live harness (another agent's run) are left alone.
 */
export function reapStale({ tmp = os.tmpdir(), log = () => {}, includeKept = false } = {}) {
  const reaped = [];
  const protectedNames = [];
  let names = [];
  try { names = fs.readdirSync(tmp).filter((n) => n.startsWith(TMP_PREFIX)); } catch { /* unreadable tmp */ }
  for (const name of names) {
    const dir = path.join(tmp, name);
    let st;
    try { st = fs.statSync(dir); } catch { continue; }
    if (!st.isDirectory()) continue;
    const pids = readPids(dir);
    if (pids?.harnessPid && alive(pids.harnessPid)) { log(`skip ${dir} (harness ${pids.harnessPid} is running)`); protectedNames.push(name); continue; }
    if (pids?.kept && !includeKept) { log(`skip ${dir} (kept for debugging; --reap removes it)`); protectedNames.push(name); continue; }
    if (!pids && Date.now() - st.mtimeMs < 60_000) { log(`skip ${dir} (just created)`); protectedNames.push(name); continue; }
    log(`reaping ${dir}`);
    if (reapDir(dir, { log })) reaped.push(dir);
    else protectedNames.push(name);
  }
  // Orphans whose dir is already gone (or never had a pids.json): nothing but the process table remembers them.
  const strays = findStrayProcesses({ tmp, skipDirs: protectedNames });
  const byDir = new Map();
  for (const p of strays) byDir.set(path.basename(p.dir), [...(byDir.get(path.basename(p.dir)) ?? []), p]); // /var vs /private/var spell one dir twice
  for (const [dirName, procs] of byDir) {
    const dir = path.join(tmp, dirName);
    log(`reaping ${procs.length} orphan process(es) of ${dir}: ${procs.map((p) => p.pid).join(', ')}`);
    const left = killProcesses(procs.map((p) => p.pid), { log });
    if (left.length) log(`  still running: ${left.join(', ')}`);
    else reaped.push(dir);
  }
  return reaped;
}
