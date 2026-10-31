// Flow 2: step-3 user is redirected to /signup/profile, live nickname check, save completes onboarding (DB).
// Also: a hard page load restores the session in one round trip when the BE's refresh carries `user` (BE 2026-10-31).
import { Browser, report } from '../lib/cdp.mjs'; import { sql, ids, check, clean, done, sleep, signIn, loginCode, API } from '../lib/harness.mjs';
import { ORIGIN } from '../lib/state.mjs';
const b = await Browser.connect(); const ctx = await b.newContext(); const p = await b.newPage(ctx);
check('precondition: newbie at step 3, not completed', sql(`select onboarding_step||' '||(onboarding_completed_at is null) from "user" where id='${ids.NEWBIE}'`) === '3 true');
await signIn(p, ids.NEWBIE);
await p.goto('/en/bounties'); await p.waitFor(`location.pathname.endsWith('/signup/profile')`, 8000);
const landed = await p.url();
// Session restore on those hard loads: refresh, then GET /auth/me only when the BE does not carry `user` (older BE).
const probe = loginCode(ids.NEWBIE);
const carried = await fetch(API + '/auth/exchange', { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-ninja-session': 'cookie' }, body: JSON.stringify({ code: probe.code, codeVerifier: probe.verifier }) })
  .then((r) => r.json()).then((body) => body.user !== undefined && Object.keys(body).sort().join() === 'accessToken,user');
const restore = p.requests.filter((r) => r.url.endsWith('/api/auth/refresh') || r.url === API + '/auth/me').map((r) => `${r.method} ${r.url.replace(API, '{API}').replace(ORIGIN, '')} ${r.status}`);
const meCalls = restore.filter((line) => line.includes('{API}/auth/me') && !line.startsWith('OPTIONS')).length;
clean(await report(p, 'redirect to onboarding', { landed }));
check('step-3 user lands on /en/signup/profile', landed.endsWith('/en/signup/profile'), landed);
check('page loads restored the session through the refresh cookie', restore.some((line) => line === 'POST /api/auth/refresh 200'), restore);
check(carried ? 'BE carries user: no GET /auth/me on a hard load (one round trip)' : 'BE without user: GET /auth/me after the refresh (fallback)', carried ? meCalls === 0 : meCalls > 0, { carried, restore });
await p.waitFor(`!!document.querySelector('#nickname')`);
await p.fill('#nickname', 'builderone');
await p.waitFor(`(document.querySelector('#nickname-status')?.innerText||'').length > 0 && !/Checking/i.test(document.querySelector('#nickname-status').innerText)`, 5000);
const takenStatus = await p.eval(`document.querySelector('#nickname-status').innerText`);
await p.fill('#nickname', 'freshninja'); await sleep(1300);
const freeStatus = await p.eval(`document.querySelector('#nickname-status').innerText`);
const checks = p.requests.filter((r) => r.url.includes('/users/check-nickname')).map((r) => r.url.split('?')[1] + ' ' + r.status);
check('taken nickname is reported taken', /taken|in use|already/i.test(takenStatus), takenStatus);
check('free nickname is reported available', /available/i.test(freeStatus), freeStatus);
check('live check hit /users/check-nickname', checks.length >= 2, checks);
await p.click('Dev'); await p.fill('#bio', 'Hello I am new');
clean(await report(p, 'nickname live check', { takenStatus, freeStatus, checks }));
await p.click('css:form button[type=submit]');
await p.waitFor(`location.pathname.includes('get-started')`, 10000); await p.idle(); await sleep(800);
const r = await report(p, 'after save', { url: await p.url() }); clean(r);
check('after save lands on get-started', r.url.includes('/signup/get-started'), r.url);
const row = sql(`select nickname||' '||onboarding_step||' '||coalesce(bio,'') from "user" where id='${ids.NEWBIE}'`);
check('DB: nickname/step/bio saved', row === 'freshninja 4 Hello I am new', row);
b.close(); done('2 onboarding');
