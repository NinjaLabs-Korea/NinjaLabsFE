// Teardown of a (possibly dead) harness run, driven only by the run's temp dir: `<dir>/pids.json` records the harness
// pid, the detached child process groups and the Postgres data directory as soon as they exist. Used by the harness's
// own cleanup, the detached watchdog (lib/watchdog.mjs) and `run-all.mjs --reap` / the startup reaper.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const TMP_PREFIX = 'ninja-it-';
export const PIDS_FILE = 'pids.json';

export const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};
const groupAlive = (pgid) => {
  try { process.kill(-pgid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
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

/** Stops the run's Postgres (immediate), kills every recorded process group that is still alive, and returns what it did. */
export function stopServices(dir, { log = () => {} } = {}) {
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
  for (const pgid of pids.groups ?? []) {
    if (!groupAlive(pgid)) continue;
    try { process.kill(-pgid, 'SIGTERM'); } catch { /* gone */ }
  }
  const deadline = Date.now() + 3000;
  while ((pids.groups ?? []).some(groupAlive) && Date.now() < deadline) sleepSync(0.2);
  for (const pgid of pids.groups ?? []) {
    if (!groupAlive(pgid)) continue;
    try { process.kill(-pgid, 'SIGKILL'); did.push(`group ${pgid} killed`); } catch { /* gone */ }
  }
  for (const d of did) log(`  ${d}`);
  return did;
}

/** Reaps every `ninja-it-*` dir under tmpdir whose harness is gone. Dirs of a live harness (another agent's run) are left alone. */
export function reapStale({ tmp = os.tmpdir(), log = () => {}, includeKept = false } = {}) {
  const reaped = [];
  let names = [];
  try { names = fs.readdirSync(tmp).filter((n) => n.startsWith(TMP_PREFIX)); } catch { /* unreadable tmp */ }
  for (const name of names) {
    const dir = path.join(tmp, name);
    let st;
    try { st = fs.statSync(dir); } catch { continue; }
    if (!st.isDirectory()) continue;
    const pids = readPids(dir);
    if (pids?.harnessPid && alive(pids.harnessPid)) { log(`skip ${dir} (harness ${pids.harnessPid} is running)`); continue; }
    if (pids?.kept && !includeKept) { log(`skip ${dir} (kept for debugging; --reap removes it)`); continue; }
    if (!pids && Date.now() - st.mtimeMs < 60_000) { log(`skip ${dir} (just created)`); continue; }
    log(`reaping ${dir}`);
    stopServices(dir, { log });
    fs.rmSync(dir, { recursive: true, force: true });
    reaped.push(dir);
  }
  return reaped;
}
