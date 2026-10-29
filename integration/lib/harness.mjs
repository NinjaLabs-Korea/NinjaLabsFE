// Shared helpers for the flows (cookie session mode): DB access, seed ids, real browser sign-in, assertions.
import { execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { state, ORIGIN, API } from './state.mjs';
import { signAccess } from './jwt.mjs';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.removeAllListeners('warning');
export { API };
/** Runs one SQL statement against the run's private database and returns the trimmed unaligned output. */
export const sql = (q) => execFileSync(state.psql, ['-h', state.pg.host, '-p', String(state.pg.port), '-U', state.pg.user, '-d', state.pg.db, '-qtAc', q]).toString().trim();
export const ids = state.ids;
export const seed = state.seed;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Inserts a one-time login code for `userId` exactly like AuthService.issueLoginCode (sha256 hex code hash, S256 challenge). */
export function loginCode(userId) {
  const code = randomBytes(32).toString('base64url'); const verifier = randomBytes(48).toString('base64url');
  const hash = createHash('sha256').update(code).digest('hex'); const challenge = createHash('sha256').update(verifier).digest('base64url');
  sql(`INSERT INTO oauth_login_code (code_hash,user_id,code_challenge) VALUES ('${hash}','${userId}','${challenge}')`);
  return { code, verifier };
}

/**
 * BODY-mode tokens straight from the BE (POST /auth/exchange without X-Ninja-Session) -> {accessToken, refreshToken}.
 * Only for API calls and the legacy-migration test: browser sessions go through `signIn` (cookie mode).
 */
export async function mint(userId) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { code, verifier } = loginCode(userId);
    const r = await fetch(API + '/auth/exchange', { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify({ code, codeVerifier: verifier }) });
    if (r.status === 429) { await sleep(15000); continue; }
    if (!r.ok) throw new Error(`mint ${userId}: ${r.status}`);
    return r.json();
  }
  throw new Error('mint: throttled');
}

/**
 * Real browser sign-in in cookie mode: login code + verifier via SQL, the verifier goes where createLoginChallenge()
 * puts it (sessionStorage["ninja.oauthVerifier"] = {verifier, createdAt}), then /en/auth/callback#loginCode=<code> makes
 * the FE POST /api/auth/exchange (Next rewrite -> BE) and receive the HttpOnly ninja_rt cookie. The callback then
 * location.replace()s to the locale home (or the onboarding step). Each flow uses a fresh browser context, so a fresh
 * cookie jar: no session is shared between flows.
 */
export async function signIn(page, userId, { landing } = {}) {
  const { code, verifier } = loginCode(userId);
  await page.goto('/en');
  await page.eval(`sessionStorage.setItem('ninja.oauthVerifier', JSON.stringify({ verifier: ${JSON.stringify(verifier)}, createdAt: Date.now() })); true`);
  page.reset();
  await page.goto(`/en/auth/callback#loginCode=${code}`);
  const left = await page.waitFor(`!location.pathname.endsWith('/auth/callback')`, 15000);
  await page.idle();
  const exchange = page.requests.filter((r) => r.url.endsWith('/api/auth/exchange')).map((r) => r.status);
  if (!left || JSON.stringify(exchange) !== '[200]') throw new Error(`signIn ${userId}: exchange ${JSON.stringify(exchange)}, left callback=${left}`);
  if (landing) await page.waitFor(`location.pathname.endsWith(${JSON.stringify(landing)})`, 8000);
  page.reset();
  return { code };
}

/** CDP view of the refresh cookie in the page's context (null when absent). */
export async function rtCookie(page) {
  const { cookies } = await page.send('Network.getCookies', { urls: [ORIGIN + '/api/auth/refresh'] });
  return cookies.find((c) => c.name === 'ninja_rt') ?? null;
}
/** Any non-cookie place a token could hide: document.cookie, localStorage and sessionStorage (keys + values). */
export const storageDump = (p) => p.eval(`JSON.stringify({ cookie: document.cookie, local: Object.fromEntries(Object.entries(localStorage)), session: Object.fromEntries(Object.entries(sessionStorage)) })`).then(JSON.parse);
/** True when a dump contains anything token-like: a JWT, a 64-char base64url string, or a ninja.*Token key. */
export function hasToken(dump, extra = []) {
  const blob = JSON.stringify(dump);
  return /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(blob) || /[A-Za-z0-9_-]{64}/.test(blob) || /ninja\.(access|refresh)Token|ninja_rt/.test(blob) || extra.some((t) => t && blob.includes(t));
}
export const H = (t) => `encode(sha256('${t}'::bytea),'hex')`;
/** Raw POST to an auth route with explicit headers (curl-like, outside the browser). */
export async function rawAuth(base, path, { headers = {}, body = {} } = {}) {
  const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { status: r.status, setCookie: r.headers.getSetCookie(), body: await r.text() };
}

export async function apiAs(token, method, path, body) {
  const r = await fetch(API + path, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', origin: ORIGIN }, body: body && JSON.stringify(body) });
  return [r.status, await r.text()];
}

const results = [];
/** Records and prints one assertion; the process exit code reflects all of them. */
/**
 * Waits for `selector` to exist, reloading the page once when it does not show up (a loaded machine hydrates slowly), and
 * fills it. Returns false after recording a failed assertion when the field never appears, so a slow page reads as one clear
 * failed check instead of an uncaught "fill target not found" that hides the rest of the flow.
 */
export async function fillWhenReady(page, selector, value, label = selector, waitMs = 20000) {
  const present = `!!document.querySelector(${JSON.stringify(selector)})`;
  let ready = await page.waitFor(present, waitMs);
  if (!ready) { await page.eval('location.reload()'); await sleep(500); ready = await page.waitFor(present, waitMs); }
  if (!ready) { check(`${label}: form field is on the page`, false, (await page.text()).replace(/\s+/g, ' ').slice(0, 300)); return false; }
  await page.fill(selector, value);
  return true;
}

export function check(label, ok, detail = '') {
  results.push({ label, ok: !!ok });
  console.log(`ASSERT ${ok ? 'PASS' : 'FAIL'} ${label}${detail !== '' ? ' :: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
  return !!ok;
}
/** Cookie mode: a page load without a session sends one POST /api/auth/refresh that the BE answers 401 (no cookie). */
export const SIGNED_OUT_PROBE = /^401 POST .*\/api\/auth\/refresh$/;
/** Asserts the page reported no hydration errors, uncaught exceptions, CSP violations or forbidden body text. */
export function clean(r, { allowFailed = [], signedOut = false } = {}) {
  if (signedOut) allowFailed = [...allowFailed, SIGNED_OUT_PROBE];
  check(`${r.label}: no hydration error`, r.hydration.length === 0, r.hydration);
  check(`${r.label}: no uncaught exception`, r.errors.length === 0, r.errors);
  // 새 외부 오리진 때문에 여기서 실패하면 `next.config.ts contentSecurityPolicy()`의 해당 지시어를 고친다.
  check(`${r.label}: no CSP violation`, r.csp.length === 0, r.csp);
  check(`${r.label}: no forbidden body text`, r.badText.length === 0, r.badText);
  const unexpected = r.failed.filter((f) => !allowFailed.some((re) => re.test(f)));
  check(`${r.label}: no unexpected failed request`, unexpected.length === 0, unexpected);
}
export function done(name) {
  const failed = results.filter((r) => !r.ok);
  console.log(`FLOW ${name} COMPLETED ${results.length - failed.length}/${results.length} assertions passed`);
  process.exitCode = failed.length ? 1 : 0;
}
/** The account area renders a "Sign out" button (mobile drawer, always in the DOM) only while signed in. */
export const signedInHeader = (p) => p.eval(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Sign out')`);
export const clickSignOut = (p) => p.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Sign out').click()`);
/** The control inside (or pointed at by) the first `main label` whose text starts with `txt`; tags it `data-fill` for `fill`. */
export async function tagLabel(p, txt) {
  const ok = await p.eval(`(()=>{document.querySelectorAll('[data-fill]').forEach(e=>e.removeAttribute('data-fill'));
    const l=[...document.querySelectorAll('main label')].find(l=>l.innerText.trim().startsWith(${JSON.stringify(txt)}));
    const el=l && (l.querySelector('input,textarea') || document.getElementById(l.htmlFor)); if(!el) return false; el.dataset.fill='1'; return true})()`);
  if (!ok) throw new Error(`label not found: ${txt} (signed out or form not rendered?)`);
  return '[data-fill="1"]';
}
export async function fillLabel(p, txt, v) { await p.fill(await tagLabel(p, txt), v); }
/** AdminSelect: open the combobox by aria-label and pick an option. */
export async function select(p, comboLabel, option) {
  await p.eval(`document.querySelector('main [role=combobox][aria-label=${JSON.stringify(comboLabel)}]').click()`); await sleep(200);
  const ok = await p.eval(`(()=>{const o=[...document.querySelectorAll('[role=option]')].find(o=>o.innerText.trim()===${JSON.stringify(option)}); if(!o) return false; o.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true})); o.click(); return true})()`);
  if (!ok) throw new Error(`option not found: ${comboLabel}=${option}`);
  await sleep(200);
}
/** Clicks the button with exact text inside the table row containing `rowText`; throws (with the visible rows) if absent. */
export async function rowButton(p, rowText, button) {
  const res = await p.eval(`(()=>{const rows=[...document.querySelectorAll('tr')]; const row=rows.find(r=>r.innerText.includes(${JSON.stringify(rowText)}));
    if(!row) return 'NO_ROW: '+rows.map(r=>r.innerText.replace(/\\s+/g,' ').slice(0,60)).join(' | ');
    const b=[...row.querySelectorAll('button')].find(b=>b.innerText.trim()===${JSON.stringify(button)}); if(!b) return 'NO_BUTTON'; b.click(); return 'OK'})()`);
  if (res !== 'OK') throw new Error(`rowButton ${rowText}/${button}: ${res}`);
  await sleep(400);
}
export const mutations = (p) => p.requests.filter((r) => !['GET', 'OPTIONS'].includes(r.method)).map((r) => `${r.method} ${r.url.replace(API, '')} ${r.status}`);
export const mainText = async (p) => (await p.eval(`(document.querySelector('main')||document.body).innerText`)).replace(/\s+/g, ' ');
/** Bearer access token for `userId` signed with the run's JWT secret (API calls outside the browser). */
export const tokenFor = (userId, adm = false) => signAccess(state.jwtSecret, userId, adm);

/** Clicks a button inside the open `<dialog>` (ConfirmDialog / Modal) by its exact text. */
export async function dialogButton(p, text) {
  const ok = await p.eval(`(()=>{const d=document.querySelector('dialog[open]'); const b=d && [...d.querySelectorAll('button')].find(b=>b.innerText.trim()===${JSON.stringify(text)}); if(!b) return false; b.click(); return true})()`);
  if (!ok) throw new Error(`dialog button not found: ${text}`);
  await sleep(400); await p.idle(500);
}
/** Clicks a chip (`label` around a radio/checkbox) by its exact text, inside `main` (or inside the fieldset whose legend starts with `legend`). */
export async function chip(p, text, legend) {
  const ok = await p.eval(`(()=>{const scope=${JSON.stringify(legend ?? '')} ? [...document.querySelectorAll('main fieldset')].find(f=>f.querySelector('legend')?.innerText.trim().startsWith(${JSON.stringify(legend ?? '')})) : document.querySelector('main'); if(!scope) return false;
    const l=[...scope.querySelectorAll('label')].find(l=>l.innerText.trim()===${JSON.stringify(text)} && l.querySelector('input')); if(!l) return false; l.querySelector('input').click(); return true})()`);
  if (!ok) throw new Error(`chip not found: ${text}`);
  await sleep(100);
}
/** Same as `signIn`, but plants `ninja.returnTo` first, the way the signup page does before leaving for Google. */
export async function signInWithReturn(page, userId, returnTo) {
  const { code, verifier } = loginCode(userId);
  await page.goto('/en');
  await page.eval(`sessionStorage.setItem('ninja.oauthVerifier', JSON.stringify({ verifier: ${JSON.stringify(verifier)}, createdAt: Date.now() })); sessionStorage.setItem('ninja.returnTo', ${JSON.stringify(returnTo)}); true`);
  page.reset();
  await page.goto(`/en/auth/callback#loginCode=${code}`);
  await page.waitFor(`!location.pathname.endsWith('/auth/callback')`, 15000);
  await page.idle();
}
