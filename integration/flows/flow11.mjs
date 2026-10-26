// Flow 11: auth-state consistency. Header, hero CTA, signup step 1 and the gated pages agree with the session in every state.
import { Browser, report } from '../lib/cdp.mjs'; import { ids, check, clean, done, sleep, signIn, mainText } from '../lib/harness.mjs';
const b = await Browser.connect();
const LOGIN = 'Continue with Google';
const links = (p, sel) => p.eval(`[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>e.getClientRects().length).map(e=>e.innerText.trim()+' -> '+new URL(e.href).pathname)`);
const heroCta = (p) => links(p, 'main section:first-of-type a');
const headerGetStarted = (p) => p.eval(`[...document.querySelectorAll('header a')].some(a=>a.getClientRects().length && a.innerText.trim()==='Get Started')`);

// ---- signed out
{
  const p = await b.newPage(await b.newContext());
  await p.goto('/en'); await sleep(600);
  const hero = await heroCta(p);
  check('signed out: hero CTA is Get Started -> signup', hero.some((l) => l === 'Get Started -> /en/signup'), hero);
  check('signed out: header shows Get Started', await headerGetStarted(p));
  clean(await report(p, 'signed-out landing', {}), { signedOut: true });
  await p.goto('/en/signup'); await p.waitText(LOGIN, 8000);
  const t = await p.text();
  check('signed out: signup step 1 shows the login', t.includes(LOGIN));
  check('signed out: no edge-case spec box', !/Edge case|Already signed-in user|declined or failed/i.test(t), t.slice(0, 300));
  check('signed out: no em dash on the page', !t.includes('-'));
  clean(await report(p, 'signed-out signup', {}), { signedOut: true });
  for (const path of ['/en/account', '/en/applications', '/en/agents', '/en/admin']) {
    await p.goto(path); await sleep(500);
    const txt = await mainText(p);
    check(`signed out: ${path} asks to sign in (never shows account content)`, /sign in|get started|log in|session/i.test(txt) || /Continue with Google/.test(txt), txt.slice(0, 160));
    clean(await report(p, `signed-out ${path}`, {}), { signedOut: true });
  }
  for (const step of ['wallet', 'profile', 'get-started']) {
    await p.goto(`/en/signup/${step}`); await p.waitFor(`location.pathname.endsWith('/en/signup')`, 8000); await sleep(600);
    const txt = await p.text();
    check(`signed out: /signup/${step} goes to step 1 with a clear message`, (await p.url()).endsWith('/en/signup') && txt.includes('Sign in to continue') && txt.includes(LOGIN), txt.slice(0, 200));
    clean(await report(p, `signed-out signup ${step}`, {}), { signedOut: true });
  }
  await p.goto('/en/agents/register'); await sleep(500);
  check('signed out: agent register asks to sign in', /Sign in before registering/i.test(await mainText(p)));
  await p.close();
}

// ---- signed in, onboarding complete (builder)
{
  const p = await b.newPage(await b.newContext());
  await signIn(p, ids.BUILDER);
  await p.goto('/en'); await sleep(800);
  // A finished user never sees the Intro: `/en` goes to their home, whose profile card links to the public profile.
  await p.waitFor(`location.pathname.endsWith('/en/home')`, 8000);
  check('complete user: /en lands on the home, not the Intro hero', (await p.url()).endsWith('/en/home'), await p.url());
  const own = await links(p, 'main a');
  check('complete user: the home links to their profile', own.some((l) => l === 'View my profile -> /en/members/builderone'), own);
  check('complete user: no Get Started anywhere on the home', !own.some((l) => l.startsWith('Get Started')), own);
  check('complete user: header has no Get Started', !(await headerGetStarted(p)));
  clean(await report(p, 'complete landing', {}));
  // hard load / direct URL entry
  await p.goto('/en/signup'); await p.waitFor(`!location.pathname.endsWith('/signup')`, 8000);
  const landed = await p.url();
  check('complete user: direct /en/signup does not stay on login', !landed.endsWith('/en/signup'), landed);
  check('complete user: never shown the login', !(await p.text()).includes(LOGIN));
  clean(await report(p, 'complete signup direct', {}));
  // arrive from another page: go back where they came from
  await p.goto('/en/bounties'); await sleep(500);
  await p.eval(`location.assign('/en/signup'); true`);
  await p.waitFor(`!location.pathname.endsWith('/signup')`, 8000); await sleep(500);
  const back = await p.url();
  check('complete user: signup sends them back to the page they came from', back.endsWith('/en/bounties'), back);
  clean(await report(p, 'complete signup from bounties', {}));
  for (const step of ['wallet', 'profile', 'get-started']) {
    await p.goto(`/en/signup/${step}`); await p.waitFor(`!location.pathname.includes('/signup')`, 8000);
    const url = await p.url();
    check(`complete user: /signup/${step} leaves the signup flow`, !url.includes('/signup'), url);
    clean(await report(p, `complete signup ${step}`, {}));
  }
  await p.goto('/en/account'); await sleep(800);
  const acct = await mainText(p);
  console.log('INFO /account offers wallet/profile editing:', /edit|change|connect/i.test(acct.replace(/Delete account/gi, '')));
  await p.goto('/en/agents/register'); await sleep(800);
  check('complete user: agent register shows no sign-in warning', !/Sign in before registering/i.test(await mainText(p)));
  await p.goto('/en/admin'); await sleep(800);
  const adminText = await mainText(p);
  check('regular user: /admin says admin only, not sign in', /Admin access only/i.test(adminText) && !/sign-in required/i.test(adminText), adminText.slice(0, 160));
  clean(await report(p, 'regular user admin', {}));
  await p.close();
}

// ---- signed in, onboarding unfinished (wallet step)
{
  const p = await b.newPage(await b.newContext());
  await signIn(p, ids.N2);
  await p.waitFor(`location.pathname.endsWith('/signup/wallet')`, 8000);
  await p.goto('/en/signup'); await p.waitFor(`location.pathname.endsWith('/signup/wallet')`, 8000);
  check('step-2 user: /en/signup goes to their step, not the login', (await p.url()).endsWith('/en/signup/wallet'), await p.url());
  check('step-2 user: never shown the login', !(await p.text()).includes(LOGIN));
  const stepper = await p.eval(`[...document.querySelectorAll('main ol li')].map(li=>li.innerText.trim()+(li.dataset.done?'(done)':'')+(li.getAttribute('aria-current')?'(current)':''))`);
  check('step-2 user: stepper shows Login done and Wallet current', stepper[0] === '1. Login(done)' && stepper[1] === '2. Wallet + NFT(current)', stepper);
  check('step-2 user: the Login step is not a link', await p.eval(`!document.querySelector('main ol li a, main ol li button')`));
  clean(await report(p, 'step-2 signup', {}));
  // client-side navigation to the landing page (a hard load would redirect): the CTA continues the owed step
  await p.click('css:header a[href="/en"]'); await sleep(800);
  const hero = await heroCta(p);
  check('step-2 user: hero CTA continues sign-up at the wallet step', hero.some((l) => l === 'Continue sign-up -> /en/signup/wallet'), hero);
  check('step-2 user: no Get Started anywhere', !hero.some((l) => l.startsWith('Get Started')) && !(await headerGetStarted(p)), hero);
  clean(await report(p, 'step-2 landing', {}));
  await p.close();
}

// ---- admin
{
  const p = await b.newPage(await b.newContext());
  await signIn(p, ids.ADMIN);
  await p.goto('/en/admin'); await sleep(1000);
  const t = await mainText(p);
  check('admin: console renders, no sign-in or access-denied copy', !/Admin access only|sign-in required|Sign in/i.test(t), t.slice(0, 160));
  await p.goto('/en/signup'); await p.waitFor(`!location.pathname.endsWith('/signup')`, 8000);
  check('admin: signup step 1 redirects away', !(await p.url()).endsWith('/en/signup'));
  clean(await report(p, 'admin', {}));
  await p.close();
}
b.close(); done('11 auth state');
