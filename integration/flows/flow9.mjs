// Flow 9: cookie-mode edges.
// A) legacy migration: a valid BODY-mode refresh token (from the BE directly) in localStorage["ninja.refreshToken"] (+ a stale
//    ninja.accessToken) -> page load -> POST /api/auth/refresh carries it once, the BE plants ninja_rt, both legacy keys are
//    removed, signed in; DB: the legacy row is rotated. Next reload uses the cookie only (empty body).
// B) CSRF: a cross-site-style POST /api/auth/refresh WITH the cookie but WITHOUT X-Ninja-Session does not use the cookie
//    (400 body mode, no Set-Cookie, the session is not rotated) - through the FE rewrite and on the BE directly.
import { Browser, report, ORIGIN } from '../lib/cdp.mjs';
import { sql, ids, check, clean, done, sleep, mint, signedInHeader, rtCookie, storageDump, hasToken, rawAuth, H, API } from '../lib/harness.mjs';
const b = await Browser.connect();
let cookieValue, legacyToken;
{ // A
  const legacy = await mint(ids.BUILDER); legacyToken = legacy.refreshToken;
  const ctx = await b.newContext(); const p = await b.newPage(ctx);
  await p.goto('/en');
  await p.eval(`localStorage.setItem('ninja.accessToken', ${JSON.stringify(legacy.accessToken)}); localStorage.setItem('ninja.refreshToken', ${JSON.stringify(legacy.refreshToken)}); true`);
  check('A: no cookie before the migration', (await rtCookie(p)) === null);
  const bodies = [];
  p.listeners.push((m, prm) => { if (m === 'Network.requestWillBeSent' && prm.request.url.endsWith('/api/auth/refresh')) bodies.push({ body: prm.request.postData ?? '', mode: prm.request.headers['x-ninja-session'] ?? prm.request.headers['X-Ninja-Session'] }); });
  p.reset();
  await p.goto('/en/applications'); await p.waitText('Build an Injective dashboard', 8000);
  const dump = await storageDump(p); const c = await rtCookie(p);
  const statuses = p.requests.filter((x) => x.url.endsWith('/api/auth/refresh')).map((x) => x.status);
  const r = await report(p, 'A: legacy migration load', { bodies }); clean(r);
  check('A: one POST /api/auth/refresh 200 carrying the legacy token with X-Ninja-Session: cookie', JSON.stringify(statuses) === '[200]' && bodies.length === 1 && JSON.parse(bodies[0].body).refreshToken === legacy.refreshToken && bodies[0].mode === 'cookie', { statuses, bodies });
  check('A: signed in via the cookie', await signedInHeader(p));
  check('A: both legacy keys removed', dump.local['ninja.accessToken'] === undefined && dump.local['ninja.refreshToken'] === undefined, dump.local);
  check('A: no token left in Web Storage / document.cookie', !hasToken(dump, [legacy.refreshToken, legacy.accessToken, c?.value]), dump);
  check('A: ninja_rt planted (HttpOnly, Path=/api/auth)', c && c.httpOnly && c.path === '/api/auth' && c.secure && c.sameSite === 'Strict', c);
  check('DB: legacy row revoked, its successor = the cookie, live', sql(`select (revoked_at is not null)::text from auth_session where refresh_token_hash=${H(legacy.refreshToken)}`) === 'true' &&
    sql(`select count(*) from auth_session where prev_refresh_token_hash=${H(legacy.refreshToken)} and refresh_token_hash=${H(c.value)} and revoked_at is null`) === '1');
  bodies.length = 0;
  await p.goto('/en/agents'); await p.waitText('PendingBot', 8000);
  check('A: next reload refreshes from the cookie only (empty body)', bodies.length === 1 && bodies[0].body === '{}', bodies);
  check('A: still signed in', await signedInHeader(p));
  cookieValue = (await rtCookie(p)).value;
  await b.disposeContext(ctx);
}
await sleep(500);
{ // B
  const hash = H(cookieValue);
  const before = sql(`select (revoked_at is null)::text||' '||coalesce(prev_rotated_at::text,'-')||' '||(select count(*) from auth_session s2 where s2.prev_refresh_token_hash=${hash}) from auth_session where refresh_token_hash=${hash}`);
  const cross = { origin: 'https://evil.example', cookie: `ninja_rt=${cookieValue}`, 'sec-fetch-site': 'cross-site' };
  const viaFe = await rawAuth(ORIGIN, '/api/auth/refresh', { headers: cross, body: {} });
  const viaBe = await rawAuth(API, '/auth/refresh', { headers: cross, body: {} });
  const logoutNoHeader = await rawAuth(ORIGIN, '/api/auth/logout', { headers: cross, body: {} });
  console.log(JSON.stringify({ viaFe, viaBe, logoutNoHeader }));
  check('B: FE-origin POST /api/auth/refresh with cookie, no X-Ninja-Session -> 400/401, no Set-Cookie', [400, 401].includes(viaFe.status) && viaFe.setCookie.length === 0, viaFe);
  check('B: BE POST /auth/refresh with cookie, no X-Ninja-Session -> 400/401, no Set-Cookie', [400, 401].includes(viaBe.status) && viaBe.setCookie.length === 0, viaBe);
  check('B: logout without the header does not touch the cookie session (400)', logoutNoHeader.status === 400 && logoutNoHeader.setCookie.length === 0, logoutNoHeader);
  const after = sql(`select (revoked_at is null)::text||' '||coalesce(prev_rotated_at::text,'-')||' '||(select count(*) from auth_session s2 where s2.prev_refresh_token_hash=${hash}) from auth_session where refresh_token_hash=${hash}`);
  check('DB: the cookie session was neither rotated nor revoked by the cross-site requests', after === before && after.startsWith('true'), { before, after });
  const withHeader = await rawAuth(ORIGIN, '/api/auth/refresh', { headers: { 'x-ninja-session': 'cookie', cookie: `ninja_rt=${cookieValue}`, origin: ORIGIN }, body: {} });
  check('B: control - the same cookie WITH the header -> 200 + new ninja_rt', withHeader.status === 200 && withHeader.setCookie.some((s) => s.startsWith('ninja_rt=') && /HttpOnly; Secure; SameSite=Strict; Path=\/api\/auth/.test(s)) && !withHeader.body.includes('refreshToken'), withHeader.status);
}
{ // C: the migrated legacy token is dead - presenting it again (its successor has rotated since) is reuse -> 401 and the chain is revoked
  const again = await rawAuth(API, '/auth/refresh', { body: { refreshToken: legacyToken } });
  check('C: migrated legacy token replayed -> 401', again.status === 401, again.status);
  const live = sql(`with recursive ch as (select refresh_token_hash h, revoked_at from auth_session where refresh_token_hash=${H(legacyToken)} union all select a.refresh_token_hash, a.revoked_at from auth_session a join ch on a.prev_refresh_token_hash=ch.h) select count(*)||' '||count(*) filter (where revoked_at is null) from ch`);
  check('DB C: reuse detection revoked every row derived from the legacy token', /^[3-9] 0$/.test(live), live);
}
b.close(); done('9 legacy migration + csrf');
