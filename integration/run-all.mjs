#!/usr/bin/env node
// Real-browser integration run: builds the BE (from $NINJA_BE_DIR) and this FE checkout into a temp dir, starts a private
// Postgres, BE, FE, two TLS proxies and headless Chrome on configurable ports, seeds, runs flows 1-10 in order, and always
// tears everything down. Never writes into either checkout (FE logs go to integration/.logs, which is git-ignored).
//
//   NINJA_BE_DIR=/path/to/NinjaLabsBE npm run test:integration            # all flows
//   NINJA_BE_DIR=... npm run test:integration -- 1 2 3                     # a subset (7 and 8 need 4 and 5)
//   npm run test:integration -- --reap     # stop + delete the leftovers of dead runs
//
// See integration/README.md for prerequisites and environment variables.
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedDatabase } from './lib/seed.mjs';
import { alive, reapStale, reapDir, writePids, TMP_PREFIX } from './lib/reaper.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FE_DIR = path.resolve(HERE, '..');
// Flow 10 runs last: it leaves an open payout on the funded bounty B1.
const ALL_FLOWS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const FLOW_TIMEOUT_MS = 6 * 60_000;

const env = process.env;
const port = (name, def) => Number(env[`NINJA_IT_${name}_PORT`] ?? def);
const P = { pg: port('PG', 54390), be: port('BE', 4390), beTls: port('BE_TLS', 4391), fe: port('FE', 3390), feTls: port('FE_TLS', 3391), cdp: port('CDP', 9390) };
const FE_ORIGIN = `https://localhost:${P.feTls}`;
const API_ORIGIN = `https://localhost:${P.beTls}`;
const pgBin = (name) => (env.PG_BIN ? path.join(env.PG_BIN, name) : name);
const args = process.argv.slice(2);
const REAP_ONLY = args.includes('--reap');
const flowArgs = args.filter((a) => a !== '--reap');
const flows = flowArgs.length ? flowArgs : ALL_FLOWS;

const log = (...a) => console.log(`[it ${new Date().toISOString().slice(11, 19)}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.removeAllListeners('warning');

// ---------------------------------------------------------------- stale runs
// A harness that was SIGKILLed (e.g. by a tool timeout) leaves Postgres, BE, FE, proxies and Chrome running. Each run records
// them in $TMPDIR/ninja-it-*/pids.json; reapStale() stops and deletes the ones whose harness is gone (never a live run's).
if (REAP_ONLY) {
  const reaped = reapStale({ log, includeKept: true });
  console.log(reaped.length ? `reaped ${reaped.length} stale run(s)` : 'nothing to reap');
  process.exit(0);
}
reapStale({ log });

// ---------------------------------------------------------------- prerequisites
function fail(msg) {
  console.error(`integration: ${msg}`);
  process.exit(2);
}
function which(bin, args = ['--version']) {
  try {
    execFileSync(bin, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
function findChrome() {
  if (env.CHROME_PATH) return env.CHROME_PATH;
  const candidates = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'];
  const found = candidates.find((c) => fs.existsSync(c));
  if (found) return found;
  return ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].find(which) ?? null;
}

const BE_DIR = env.NINJA_BE_DIR && path.resolve(env.NINJA_BE_DIR);
if (!BE_DIR || !fs.existsSync(path.join(BE_DIR, 'package.json'))) fail('set NINJA_BE_DIR to a NinjaLabsBE checkout (with node_modules installed)');
if (!fs.existsSync(path.join(BE_DIR, 'node_modules'))) fail(`${BE_DIR}/node_modules is missing: run npm ci there first`);
if (!fs.existsSync(path.join(FE_DIR, 'node_modules'))) fail(`${FE_DIR}/node_modules is missing: run npm ci first`);
if (Number(process.versions.node.split('.')[0]) < 22) fail('Node 22+ is required (built-in WebSocket)');
for (const bin of ['initdb', 'pg_ctl', 'psql']) if (!which(pgBin(bin))) fail(`${bin} not found (install Postgres binaries or set PG_BIN)`);
if (!which('openssl', ['version'])) fail('openssl not found');
const CHROME = findChrome();
if (!CHROME) fail('Chrome/Chromium not found (set CHROME_PATH)');
for (const f of flows) if (!ALL_FLOWS.includes(f)) fail(`unknown flow "${f}" (expected ${ALL_FLOWS.join(' ')})`);

// ---------------------------------------------------------------- process + cleanup bookkeeping
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), TMP_PREFIX));
writePids(TMP, { harnessPid: process.pid, pgBin: env.PG_BIN ?? null, pgData: path.join(TMP, 'pg'), groups: [] });
// Detached watchdog: tears everything down if this process dies without running cleanup() (SIGKILL).
spawn(process.execPath, [path.join(HERE, 'lib/watchdog.mjs'), String(process.pid), TMP, env.NINJA_IT_KEEP_TMP === '1' ? '1' : '0'], { detached: true, stdio: 'ignore' }).unref();
const LOGS = path.resolve(env.NINJA_IT_LOG_DIR ?? path.join(HERE, '.logs', new Date().toISOString().replace(/[:.]/g, '-')));
fs.mkdirSync(LOGS, { recursive: true });
const children = [];
let pgStarted = false;
let cleaned = false;

/** Starts a long-running child in its own process group so the whole tree can be killed. */
function startProc(name, cmd, args, opts) {
  const out = fs.openSync(path.join(LOGS, `${name}.log`), 'a');
  // detached = own session/process group (pgid == child.pid); recorded in pids.json synchronously right after the spawn. A kill
  // landing in that gap is covered by the process-table scan in lib/reaper.mjs (cwd/command line inside the run dir).
  const child = spawn(cmd, args, { ...opts, stdio: ['ignore', out, out], detached: true });
  child.on('exit', (code, signal) => { child.exited = true; if (!cleaned) log(`${name} exited (${code ?? signal})`); });
  children.push({ name, child });
  writePids(TMP, { groups: children.map((c) => c.child.pid) });
  return child;
}
/** Runs a build/setup command to completion, logging to LOGS/<name>.log; throws with the log tail on failure. */
function run(name, cmd, args, opts) {
  const file = path.join(LOGS, `${name}.log`);
  return new Promise((resolve, reject) => {
    const out = fs.openSync(file, 'a');
    const child = spawn(cmd, args, { ...opts, stdio: ['ignore', out, out] });
    child.on('error', reject);
    child.on('exit', (code) => {
      fs.closeSync(out);
      if (code === 0) return resolve();
      const tail = fs.readFileSync(file, 'utf8').split('\n').slice(-25).join('\n');
      reject(new Error(`${name} failed (exit ${code}); see ${file}\n${tail}`));
    });
  });
}

function cleanup() {
  if (cleaned) return;
  cleaned = true;
  for (const { child } of children.reverse()) {
    if (child.exited) continue;
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
  }
  const deadline = Date.now() + 5000;
  while (children.some(({ child }) => !child.exited && alive(child.pid)) && Date.now() < deadline) execFileSync('sleep', ['0.2']);
  for (const { child } of children) {
    if (alive(child.pid)) try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
  }
  if (pgStarted) {
    try { execFileSync(pgBin('pg_ctl'), ['-D', path.join(TMP, 'pg'), 'stop', '-m', 'fast', '-w'], { stdio: 'ignore' }); } catch { /* not running */ }
  }
  // Last line of defence: also kills anything that escaped its group (found by cwd/command line in $TMPDIR/ninja-it-*), and
  // deletes the temp dir only once every recorded group and stray process is confirmed dead (otherwise it stays for --reap).
  const keep = env.NINJA_IT_KEEP_TMP === '1';
  if (keep) writePids(TMP, { kept: true });
  const deleted = reapDir(TMP, { keep, log });
  if (keep) log(`kept temp dir ${TMP}`);
  else if (!deleted) log(`temp dir ${TMP} kept: processes would not die; run "npm run test:integration -- --reap"`);
}
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { log(`${sig}: cleaning up`); cleanup(); process.exit(130); });

// ---------------------------------------------------------------- helpers
async function assertPortsFree() {
  for (const [name, p] of Object.entries(P)) {
    await new Promise((resolve) => {
      const s = net.createServer();
      s.once('error', () => fail(`port ${p} (${name}) is in use: set NINJA_IT_${name.replace(/[A-Z]/g, (c) => '_' + c).toUpperCase()}_PORT, or run "npm run test:integration -- --reap" if it is a leftover of a killed run`));
      s.listen(p, '127.0.0.1', () => s.close(resolve));
    });
  }
}
async function waitFor(label, probe, ms = 60_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try { if (await probe()) return; } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error(`${label} did not come up within ${ms / 1000}s (logs: ${LOGS})`);
}
/** Copies a git checkout's tracked + untracked-but-not-ignored files (its working tree, uncommitted edits included). */
function copyCheckout(src, dst) {
  const files = execFileSync('git', ['-C', src, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { maxBuffer: 64 << 20 })
    .toString().split('\0').filter(Boolean);
  for (const f of files) {
    const from = path.join(src, f);
    if (!fs.existsSync(from) || fs.lstatSync(from).isDirectory()) continue; // deleted in the working tree / submodule
    fs.mkdirSync(path.dirname(path.join(dst, f)), { recursive: true });
    fs.copyFileSync(from, path.join(dst, f));
  }
}
/** node_modules as a real directory (Turbopack rejects a symlink outside the project root); APFS clone on macOS. */
function cloneNodeModules(src, dst) {
  if (process.platform === 'darwin') execFileSync('cp', ['-Rc', path.join(src, 'node_modules'), dst]);
  else fs.cpSync(path.join(src, 'node_modules'), path.join(dst, 'node_modules'), { recursive: true, verbatimSymlinks: true });
}
const baseEnv = () => Object.fromEntries(['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'SHELL'].filter((k) => env[k]).map((k) => [k, env[k]]));

// ---------------------------------------------------------------- main
async function main() {
  await assertPortsFree();
  log(`temp dir ${TMP}`);
  log(`logs     ${LOGS}`);
  const jwtSecret = randomBytes(32).toString('hex');
  const pgUrl = `postgresql://postgres@127.0.0.1:${P.pg}/ninja`;
  const psql = pgBin('psql');
  const sqlOn = (db) => (q) => execFileSync(psql, ['-h', '127.0.0.1', '-p', String(P.pg), '-U', 'postgres', '-d', db, '-qtAc', q]).toString().trim();

  // TLS material: generated per run inside the temp dir, deleted with it.
  const tls = path.join(TMP, 'tls');
  fs.mkdirSync(tls);
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(tls, 'key.pem'), '-out', path.join(tls, 'cert.pem'),
    '-days', '2', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });

  const beEnv = {
    ...baseEnv(), PORT: String(P.be), NODE_ENV: 'development', TRUST_PROXY: '0', DATABASE_URL: pgUrl, PGSSLMODE: 'disable',
    CORS_ORIGINS: FE_ORIGIN, AUTH_ALLOWED_REDIRECT_ORIGINS: FE_ORIGIN, AUTH_SUCCESS_REDIRECT: `${FE_ORIGIN}/`,
    GOOGLE_CLIENT_ID: 'stub-client-id', GOOGLE_CLIENT_SECRET: 'stub-secret', GOOGLE_CALLBACK_URL: `${API_ORIGIN}/auth/google/callback`,
    JWT_SECRET: jwtSecret, JWT_ACCESS_TTL: '60s', JWT_REFRESH_TTL: '14d', INJECTIVE_NETWORK: 'testnet', INJECTIVE_EVM_CHAIN_ID: '1439',
  };
  const feEnv = {
    ...baseEnv(), NINJA_DEPLOYMENT_TIER: 'test', NINJA_RUNTIME_MODE: 'api', NINJA_APP_ORIGIN: FE_ORIGIN, NINJA_API_BASE_URL: API_ORIGIN,
    NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID: '1439', NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL: 'https://k8s.testnet.json-rpc.injective.network/',
    NODE_TLS_REJECT_UNAUTHORIZED: '0', NODE_EXTRA_CA_CERTS: path.join(tls, 'cert.pem'), NEXT_TELEMETRY_DISABLED: '1',
  };

  // Builds (in parallel): copies of both checkouts in the temp dir.
  const beBuild = path.join(TMP, 'be');
  const feBuild = path.join(TMP, 'fe');
  log(`copying BE ${BE_DIR} and FE ${FE_DIR}`);
  copyCheckout(BE_DIR, beBuild);
  copyCheckout(FE_DIR, feBuild);
  cloneNodeModules(BE_DIR, beBuild);
  cloneNodeModules(FE_DIR, feBuild);
  log('building BE (nest build) and FE (next build)');
  const builds = Promise.all([
    run('be-build', process.execPath, [path.join(beBuild, 'node_modules/@nestjs/cli/bin/nest.js'), 'build'], { cwd: beBuild, env: beEnv }),
    run('fe-build', process.execPath, [path.join(feBuild, 'node_modules/next/dist/bin/next'), 'build'], { cwd: feBuild, env: feEnv }),
  ]);

  // Postgres while the builds run: TCP on 127.0.0.1 only, no unix socket (long temp paths exceed the socket path limit).
  const pgData = path.join(TMP, 'pg');
  execFileSync(pgBin('initdb'), ['-D', pgData, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--no-locale'], { stdio: 'ignore' });
  fs.appendFileSync(path.join(pgData, 'postgresql.conf'), `\nport = ${P.pg}\nlisten_addresses = '127.0.0.1'\nunix_socket_directories = ''\nfsync = off\n`);
  execFileSync(pgBin('pg_ctl'), ['-D', pgData, '-l', path.join(LOGS, 'postgres.log'), '-w', 'start'], { stdio: 'ignore' });
  pgStarted = true;
  sqlOn('postgres')('create database ninja');
  await builds;
  log('builds done; migrating');
  await run('migrate', process.execPath, ['scripts/migrate.js'], { cwd: beBuild, env: beEnv });

  startProc('be', process.execPath, ['dist/main.js'], { cwd: beBuild, env: beEnv });
  startProc('tls-be', process.execPath, [path.join(HERE, 'lib/tls-proxy.mjs'), String(P.beTls), String(P.be), tls], { env: baseEnv() });
  await waitFor('BE /health', async () => (await (await fetch(`${API_ORIGIN}/health`)).text()).includes('"up"'));

  log('seeding');
  const seeded = await seedDatabase({ sql: sqlOn('ninja'), apiOrigin: API_ORIGIN, feOrigin: FE_ORIGIN, jwtSecret });

  // No `-H 127.0.0.1`: with an explicit hostname Next treats the x-forwarded-proto=https request as foreign and answers the
  // proxy.ts 404 rewrite with a 500 ("write EPROTO"). Same as the stack the flows were written against.
  startProc('fe', process.execPath, [path.join(feBuild, 'node_modules/next/dist/bin/next'), 'start', '-p', String(P.fe)], { cwd: feBuild, env: feEnv });
  startProc('tls-fe', process.execPath, [path.join(HERE, 'lib/tls-proxy.mjs'), String(P.feTls), String(P.fe), tls], { env: baseEnv() });
  startProc('chrome', CHROME, ['--headless=new', `--remote-debugging-port=${P.cdp}`, '--remote-debugging-address=127.0.0.1', '--ignore-certificate-errors',
    `--user-data-dir=${path.join(TMP, 'chrome')}`, '--no-first-run', '--no-default-browser-check', ...(env.NINJA_IT_CHROME_FLAGS ?? '').split(/\s+/).filter(Boolean), 'about:blank'], { env: baseEnv() });
  await waitFor('FE /en', async () => (await fetch(`${FE_ORIGIN}/en`)).status === 200);
  await waitFor('Chrome CDP', async () => (await fetch(`http://127.0.0.1:${P.cdp}/json/version`)).ok);

  const statePath = path.join(TMP, 'state.json');
  fs.writeFileSync(statePath, JSON.stringify({
    feOrigin: FE_ORIGIN, apiOrigin: API_ORIGIN, cdpPort: P.cdp, psql, pg: { host: '127.0.0.1', port: P.pg, user: 'postgres', db: 'ninja' },
    jwtSecret, ...seeded,
  }, null, 2));

  // Flows run strictly in order: 7 and 8 rely on 4's application/submission and 5's agents.
  const results = [];
  for (const f of flows) {
    const file = path.join(LOGS, `flow${f}.log`);
    log(`flow ${f} ...`);
    const code = await runFlow(path.join(HERE, 'flows', `flow${f}.mjs`), file, { ...baseEnv(), NINJA_IT_STATE: statePath, NODE_TLS_REJECT_UNAUTHORIZED: '0' });
    const text = fs.readFileSync(file, 'utf8');
    const summary = text.split('\n').find((l) => l.startsWith('FLOW ')) ?? `FLOW ${f} CRASHED (exit ${code})`;
    const failures = text.split('\n').filter((l) => l.startsWith('ASSERT FAIL'));
    const ok = code === 0 && summary.includes('COMPLETED') && failures.length === 0;
    results.push({ f, ok, summary });
    log(`${ok ? 'PASS' : 'FAIL'} ${summary}`);
    for (const l of failures) log(`  ${l.slice(0, 400)}`);
    if (!summary.includes('COMPLETED')) log(text.split('\n').slice(-8).join('\n'));
  }
  dumpDb(sqlOn('ninja'));
  console.log('\n## integration summary');
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.summary}`);
  console.log(`logs: ${LOGS}`);
  return results.every((r) => r.ok) ? 0 : 1;
}

function runFlow(script, logFile, flowEnv) {
  return new Promise((resolve) => {
    const out = fs.openSync(logFile, 'w');
    const child = spawn(process.execPath, [script], { cwd: path.dirname(script), env: flowEnv, stdio: ['ignore', out, out] });
    const timer = setTimeout(() => { fs.appendFileSync(logFile, `\nTIMEOUT after ${FLOW_TIMEOUT_MS / 1000}s\n`); child.kill('SIGKILL'); }, FLOW_TIMEOUT_MS);
    child.on('exit', (code) => { clearTimeout(timer); fs.closeSync(out); resolve(code ?? 1); });
  });
}

function dumpDb(sql) {
  const queries = [
    `select 'user', nickname, onboarding_step, is_member, coalesce(member_role,'') from "user" order by created_at`,
    `select 'bounty', title, category, status from bounty order by created_at`,
    `select 'notice', title, status, published_at is not null from notice order by created_at`,
    `select 'highlight', title, coalesce(link_url,'NULL') from platform_highlight order by created_at`,
    `select 'agent', name, status from agent order by created_at`,
    `select 'application', b.title, a.status from bounty_application a join bounty b on b.id=a.bounty_id order by b.created_at, a.status`,
    `select 'sessions', count(*), count(*) filter (where revoked_at is null) from auth_session`,
  ];
  const out = queries.map((q) => { try { return sql(q); } catch (e) { return `ERR ${e.message}`; } }).join('\n');
  fs.writeFileSync(path.join(LOGS, 'db.txt'), out + '\n');
}

let exitCode = 1;
try {
  exitCode = await main();
} catch (e) {
  console.error(`integration: ${e.stack ?? e}`);
  exitCode = 1;
} finally {
  cleanup();
}
process.exit(exitCode);
