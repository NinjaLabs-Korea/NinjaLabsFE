// Flow 7: cookie session + refresh.
// A) browser login (callback exchange through the Next rewrite) -> ninja_rt cookie with exact attributes on the FE host,
//    invisible to document.cookie, no token in Web Storage; reload -> init refresh via the cookie (rotation in DB);
//    access expiry (JWT_ACCESS_TTL=60s) -> action 401 -> one /api/auth/refresh 200 -> retry 201 (one DB row).
// B) two tabs of one context reload at the same moment -> both signed in, every refresh 200, no logout, no
//    reuse-detection revocation. C) same with each refresh held 1.5 s at the network layer (Web Locks serialize them).
import { Browser, report, ORIGIN } from '../lib/cdp.mjs';
import { sql, ids, seed, check, clean, done, sleep, signIn, signedInHeader, rtCookie, storageDump, hasToken, H, API } from '../lib/harness.mjs';
const BUILDER = ids.BUILDER;
const refreshes = (p) => p.requests.filter((r) => r.url === ORIGIN + '/api/auth/refresh' && r.method === 'POST').map((r) => r.status);
const logouts = (p) => p.requests.filter((r) => r.url.endsWith('/auth/logout'));
const started = sql(`select now()`);
const b = await Browser.connect();
{ // A
  const ctx = await b.newContext(); const p = await b.newPage(ctx);
  await signIn(p, BUILDER);
  const c = await rtCookie(p);
  const now = Date.now() / 1000;
  check('A: ninja_rt cookie present after the callback exchange', !!c, c);
  check('A: cookie attributes exact (host localhost, Path=/api/auth, Secure, HttpOnly, SameSite=Strict, no Domain attr)',
    c && c.domain === 'localhost' && c.path === '/api/auth' && c.secure === true && c.httpOnly === true && c.sameSite === 'Strict' && c.session === false, c);
  check('A: cookie Max-Age = JWT_REFRESH_TTL (14 d)', c && Math.abs(c.expires - now - 14 * 86400) < 120, c && c.expires - now);
  const otherPath = (await p.send('Network.getCookies', { urls: [ORIGIN + '/en'] })).cookies.filter((x) => x.name === 'ninja_rt');
  check('A: cookie is not sent to page routes (Path scoped)', otherPath.length === 0, otherPath);
  check('DB: the cookie value is a live auth_session for the builder', sql(`select user_id||' '||(revoked_at is null)::text from auth_session where refresh_token_hash=${H(c.value)}`) === `${BUILDER} true`);
  const dump = await storageDump(p);
  check('A: document.cookie does not expose ninja_rt', !dump.cookie.includes('ninja_rt') && !dump.cookie.includes(c.value), dump.cookie);
  check('A: localStorage/sessionStorage hold no token', !hasToken({ local: dump.local, session: dump.session }, [c.value]), dump);
  check('A: signed in after the callback', await signedInHeader(p));
  // reload: in-memory access token is gone, init refresh restores it from the cookie
  await p.goto('/en/applications'); await p.waitText('Build an Injective dashboard', 8000);
  const c2 = await rtCookie(p);
  const rReload = await report(p, 'A: reload', { refreshes: refreshes(p) }); clean(rReload);
  check('A: reload -> exactly one POST /api/auth/refresh 200', JSON.stringify(rReload.refreshes) === '[200]', rReload.refreshes);
  check('A: still signed in after reload (init refresh via cookie)', await signedInHeader(p));
  check('A: cookie rotated by the refresh', c2 && c2.value !== c.value && c2.httpOnly && c2.path === '/api/auth');
  check('DB: rotation revoked the login row and created one live successor', sql(`select (revoked_at is not null)::text from auth_session where refresh_token_hash=${H(c.value)}`) === 'true' &&
    sql(`select count(*) from auth_session where prev_refresh_token_hash=${H(c.value)} and refresh_token_hash=${H(c2.value)} and revoked_at is null`) === '1');
  // access-token expiry during an action
  await p.goto(`/en/bounties/${seed.B2}`); await p.waitFor(`!!document.querySelector('form input[name=submissionUrl]')`, 8000);
  await p.fill('form input[name=submissionUrl]', 'https://github.com/builderone/tutorial'); await p.fill('form textarea[name=description]', 'Tutorial written.');
  console.log('waiting 65 s for the 60 s access token to expire');
  await sleep(65000); p.reset();
  await p.click('css:form button[type=submit]'); await sleep(2500); await p.idle();
  const posts = p.requests.filter((r) => r.method === 'POST').map((r) => `${r.url.replace(API, '').replace(ORIGIN, '')} ${r.status}`);
  clean(await report(p, 'A: action after access expiry', { posts }), { allowFailed: [/^401 POST .*\/submissions$/] });
  check('A: submit 401 -> /api/auth/refresh 200 -> retry 201', JSON.stringify(posts) === JSON.stringify([`/bounties/${seed.B2}/submissions 401`, '/api/auth/refresh 200', `/bounties/${seed.B2}/submissions 201`]), posts);
  check('A: panel shows the submitted copy', /submitted/i.test(await p.text()));
  check('DB: exactly one submission row for the retried action', sql(`select count(*) from bounty_submission where bounty_id='${seed.B2}' and submitter_user_id='${BUILDER}'`) === '1');
  await b.disposeContext(ctx);
}
const twoTabs = async (label, hold) => {
  const ctx = await b.newContext(); const p1 = await b.newPage(ctx); const p2 = await b.newPage(ctx);
  await signIn(p1, BUILDER);
  const login = (await rtCookie(p1)).value;
  await p2.goto('/en/agents'); await p2.waitText('PendingBot', 10000);
  check(`${label}: second tab signed in from the shared cookie`, await signedInHeader(p2));
  const paused = [];
  if (hold) for (const [name, p] of [['t1', p1], ['t2', p2]]) {
    await p.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/auth/refresh', requestStage: 'Request' }] });
    p.listeners.push((m, prm) => { if (m === 'Fetch.requestPaused') { paused.push(name); setTimeout(() => p.send('Fetch.continueRequest', { requestId: prm.requestId }).catch(() => {}), 1500); } });
  }
  p1.reset(); p2.reset();
  await Promise.all([p1.goto('/en/applications'), p2.goto('/en/agents')]);
  await Promise.all([p1.waitText('Build an Injective dashboard', 12000), p2.waitText('PendingBot', 12000)]);
  await sleep(1000);
  const total = [...refreshes(p1), ...refreshes(p2)];
  const s1 = await signedInHeader(p1), s2 = await signedInHeader(p2);
  const lo = [...logouts(p1), ...logouts(p2)].length;
  clean(await report(p1, `${label}: tab1`, { total, paused })); clean(await report(p2, `${label}: tab2`));
  check(`${label}: simultaneous reload -> one refresh per tab, all 200`, JSON.stringify(total) === '[200,200]', { total, paused });
  check(`${label}: both tabs signed in, no logout request`, s1 && s2 && lo === 0, { s1, s2, lo });
  const tail = (await rtCookie(p1)).value;
  check(`DB ${label}: the chain from the login row ends in one live row = the current cookie (no reuse revocation)`,
    sql(`with recursive ch as (select refresh_token_hash h, revoked_at from auth_session where refresh_token_hash=${H(login)} union all select a.refresh_token_hash, a.revoked_at from auth_session a join ch on a.prev_refresh_token_hash=ch.h) select count(*) filter (where revoked_at is null)||' '||bool_or(h=${H(tail)} and revoked_at is null)::text from ch`) === '1 true');
  await Promise.all([p1.goto('/en/applications'), p2.goto('/en/agents')]); await sleep(800);
  check(`${label}: both still signed in after a second reload`, await signedInHeader(p1) && await signedInHeader(p2));
  await b.disposeContext(ctx);
};
await twoTabs('B', false);
await twoTabs('C (held refresh race)', true);
const live = sql(`select count(*) from auth_session where user_id='${BUILDER}' and created_at >= '${started}' and revoked_at is null`);
check('DB: exactly three live session tails (A, B, C)', live === '3', live);
b.close(); done('7 cookie session + refresh');
