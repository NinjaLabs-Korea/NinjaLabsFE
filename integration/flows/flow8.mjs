// Flow 8: sign-out in cookie mode.
// A) tab A signs out -> POST /api/auth/logout 204, cookie cleared, tab B (same context) flips to signed-out WITHOUT a
//    reload (BroadcastChannel "ninja-auth"), DB session revoked, the old refresh token is unusable in cookie and body mode.
// B) mid-session rejection: sessions revoked server-side + access expiry -> the next action's refresh 401 flips the UI to
//    signed-out in the same document and the BE clears the dead cookie.
import { Browser, report, ORIGIN } from '../lib/cdp.mjs';
import { sql, ids, seed, check, clean, done, sleep, signIn, signedInHeader, clickSignOut, rtCookie, rawAuth, H, API } from '../lib/harness.mjs';
const b = await Browser.connect();
{ // A
  const ctx = await b.newContext(); const p = await b.newPage(ctx); const p2 = await b.newPage(ctx);
  await signIn(p, ids.BUILDER);
  await p.goto('/en/applications'); await p.waitText('Build an Injective dashboard');
  await p2.goto('/en/agents'); await p2.waitText('PendingBot');
  const old = (await rtCookie(p)).value; p.reset(); p2.reset();
  check('A: both tabs signed in before', await signedInHeader(p) && await signedInHeader(p2));
  await clickSignOut(p); await sleep(2000); await p.idle();
  const posts = p.requests.filter((r) => r.method === 'POST').map((r) => `${r.url.replace(ORIGIN, '')} ${r.status}`);
  clean(await report(p, 'A: sign out', { posts }));
  check('A: POST /api/auth/logout 204 (same origin, through the rewrite)', posts.includes('/api/auth/logout 204'), posts);
  check('A: cookie cleared in the browser', (await rtCookie(p)) === null, await rtCookie(p));
  check('A: tab A signed out', !(await signedInHeader(p)));
  const flipped = await p2.waitFor(`![...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Sign out')`, 5000);
  const p2text = (await p2.text()).replace(/\s+/g, ' ');
  const p2reqs = p2.requests.map((r) => `${r.method} ${r.url}`);
  clean(await report(p2, 'A: other tab without reload', { p2reqs }));
  check('A: tab B flipped to signed-out without a reload (BroadcastChannel)', flipped);
  check('A: tab B made no request to learn it (no navigation, no refresh)', !p2reqs.some((r) => /\/api\/auth\//.test(r)) && !p2reqs.some((r) => r.startsWith('GET ' + ORIGIN + '/en/agents')), p2reqs);
  check('A: tab B shows the signed-out agents copy', p2text.includes('Sign in to manage your agents'), p2text.slice(0, 200));
  check('DB: the session is revoked', sql(`select (revoked_at is not null)::text from auth_session where refresh_token_hash=${H(old)}`) === 'true');
  const viaCookie = await rawAuth(ORIGIN, '/api/auth/refresh', { headers: { 'x-ninja-session': 'cookie', cookie: `ninja_rt=${old}`, origin: ORIGIN } });
  const viaBody = await rawAuth(API, '/auth/refresh', { body: { refreshToken: old } });
  check('A: old refresh token after logout -> 401 in cookie mode (and the dead cookie is cleared)', viaCookie.status === 401 && viaCookie.setCookie.some((s) => /^ninja_rt=;.*Max-Age=0/.test(s)), viaCookie);
  check('A: old refresh token after logout -> 401 in body mode', viaBody.status === 401, viaBody.status);
  await p2.goto('/en/agents'); await sleep(800);
  check('A: tab B still signed out after reload', !(await signedInHeader(p2)));
  await b.disposeContext(ctx);
}
{ // B
  const ctx = await b.newContext(); const p = await b.newPage(ctx);
  await signIn(p, ids.BUILDER);
  await p.goto(`/en/bounties/${seed.B3}`); await p.waitFor(`!!document.querySelector('form input[name=submissionUrl]') || document.body.innerText.includes('Actions available')`, 8000);
  check('B: signed in on the bounty page', await signedInHeader(p));
  sql(`update auth_session set revoked_at=now() where user_id='${ids.BUILDER}' and revoked_at is null`);
  console.log('waiting 65 s for the 60 s access token to expire'); await sleep(65000); p.reset();
  await p.eval(`(()=>{const a=[...document.querySelectorAll('a')].find(a=>a.getAttribute('href')?.endsWith('/applications')); if(a){a.click(); return true} return false})()`);
  const flipped = await p.waitFor(`![...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Sign out')`, 8000);
  await p.idle();
  const reqs = p.requests.filter((x) => (x.url.startsWith(API) || x.url.startsWith(ORIGIN + '/api/')) && x.method !== 'OPTIONS').map((x) => `${x.method} ${x.url.replace(API, '').replace(ORIGIN, '')} ${x.status}`);
  const url = await p.url();
  clean(await report(p, 'B: rejected refresh mid-session', { reqs, url }), { allowFailed: [/^401 /] });
  check('B: refresh was rejected with 401', reqs.includes('POST /api/auth/refresh 401'), reqs);
  check('B: UI flipped to signed-out without a reload', flipped, reqs);
  check('B: the BE cleared the dead cookie', (await rtCookie(p)) === null);
  check('B: same document, client route', url.endsWith('/en/applications'), url);
  await b.disposeContext(ctx);
}
b.close(); done('8 sign-out');
