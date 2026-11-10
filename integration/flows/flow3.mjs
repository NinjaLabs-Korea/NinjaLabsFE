// Flow 3: the removed wallet signup step. Old /signup/wallet links redirect to /signup/profile (next.config.ts, 307);
// a signed-out visitor ends on step 1, a legacy step-2 user (BE still starts new users at 2 until BE PR2) on the profile
// step with the 3-step indicator. No wallet row is written.
import { Browser, report } from '../lib/cdp.mjs'; import { sql, ids, check, clean, done, sleep, signIn } from '../lib/harness.mjs';
const b = await Browser.connect(); const ctx = await b.newContext(); const p = await b.newPage(ctx);
await p.goto('/en/signup/wallet'); await p.waitFor(`location.pathname.endsWith('/en/signup')`, 8000); await sleep(800);
const out = await p.text();
clean(await report(p, 'wallet url signed-out'), { signedOut: true });
check('signed-out /en/signup/wallet ends on step 1 with a message', out.includes('Sign in to continue') && out.includes('Continue with Google'), out.slice(0, 300));
await signIn(p, ids.N2, { landing: '/signup/profile' });
await p.goto('/en/signup/wallet'); await p.waitFor(`location.pathname.endsWith('/signup/profile')`, 8000);
const landed = await p.url(); clean(await report(p, 'wallet url step-2 user', { landed }));
check('step-2 user: /en/signup/wallet redirects to /en/signup/profile', landed.endsWith('/en/signup/profile'), landed);
await p.goto('/en/bounties'); await p.waitFor(`location.pathname.endsWith('/signup/profile')`, 8000);
check('step-2 user: other pages resume at the profile step', (await p.url()).endsWith('/en/signup/profile'), await p.url());
await p.waitFor(`document.querySelectorAll('main ol li').length > 0`, 8000);
const stepper = await p.eval(`[...document.querySelectorAll('main ol li')].map(li=>li.innerText.trim()+(li.dataset.done?'(done)':'')+(li.getAttribute('aria-current')?'(current)':''))`);
check('stepper has 3 steps with Profile current', stepper.length === 3 && stepper[1] === '2. Profile(current)', stepper);
const db = sql(`select (select count(*) from wallet where user_id='${ids.N2}')||' '||(select onboarding_step from "user" where id='${ids.N2}')`);
check('DB: no wallet row, still step 2', db === '0 2', db);
b.close(); done('3 wallet step redirect');
