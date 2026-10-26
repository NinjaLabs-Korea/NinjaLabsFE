// Flow 15: community-first landing. `/` introduces Ninja Labs (community hero, activities -> members -> achievements -> open bounties
// -> recruitment banner), the bounty marketing hero sits at the top of `/bounties`, a stat block that is all zero is hidden, the
// page titles follow the new framing, and none of the changed screens is clipped at the in-between widths (340, 530, 700, 900,
// 1100) in ko, en and zh, signed out and as a finished user (probe: lib/layout-audit.mjs; flow 14 sweeps every 20 px width).
import { Browser, report } from '../lib/cdp.mjs';
import { state } from '../lib/state.mjs';
import { denseProbe } from '../lib/layout-audit.mjs';
import { API, ids, seed, check, clean, done, sleep, signIn, apiAs, tokenFor, mainText } from '../lib/harness.mjs';

const b = await Browser.connect();
const adminToken = tokenFor(ids.ADMIN, true);
const links = (p, sel) => p.eval(`[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>e.getClientRects().length).map(e=>e.innerText.trim()+' -> '+new URL(e.href).pathname+new URL(e.href).search)`);
const h2s = (p) => p.eval(`[...document.querySelectorAll('main h2')].filter(e=>e.getClientRects().length).map(e=>e.innerText.trim())`);

// ---- setup: one OPEN cohort so the hero offers the application
let cohortName;
{
  const [, listBody] = await apiAs(adminToken, 'GET', '/admin/cohorts');
  const cohorts = JSON.parse(listBody);
  let open = cohorts.find((c) => c.status === 'OPEN');
  if (!open) {
    if (cohorts[0]) await apiAs(adminToken, 'POST', `/admin/cohorts/${cohorts[0].id}/transition`, { to: 'OPEN' });
    else {
      const [, made] = await apiAs(adminToken, 'POST', '/admin/cohorts', { name: 'Landing Cohort', description: 'Ninja Labs 모집 안내입니다.', closesAt: new Date(Date.now() + 20 * 864e5).toISOString() });
      await apiAs(adminToken, 'POST', `/admin/cohorts/${JSON.parse(made).id}/transition`, { to: 'OPEN' });
    }
  }
  open = JSON.parse((await apiAs(adminToken, 'GET', '/admin/cohorts'))[1]).find((c) => c.status === 'OPEN');
  cohortName = open?.name;
  check('setup: a cohort is open', !!open, cohortName);
}
const stats = await (await fetch(`${API}/hall-of-fame/stats`)).json();
const statsAllZero = [stats.completedBounties, stats.builders, stats.completionNfts, stats.sponsors].every((v) => Number(v) === 0) && (stats.paidTotals ?? []).every((t) => /^0*$/.test(String(t.amount)));
console.log('hall of fame stats', JSON.stringify(stats), 'allZero', statsAllZero);

// ---- signed out: the Intro
{
  const p = await b.newPage(await b.newContext());
  await p.goto('/en'); await p.waitText(`Apply to join ${cohortName}`, 10000);
  const title = await p.eval(`document.querySelector('main h1')?.innerText`);
  check('Intro: the headline is the community one', /Learn, build, and move together/.test(title ?? ''), title);
  const text = await mainText(p);
  check('Intro: no bounty marketing hero (headline, NFT card)', !/Complete bounties\. Collect proof/.test(text) && !text.includes('ninja.inj'), text.slice(0, 200));
  check('Intro: eyebrow is Injective Contributor Hub', text.includes('Injective Contributor Hub'));
  const hero = await links(p, 'main section:first-of-type a');
  check('Intro: Get Started -> signup', hero.includes('Get Started -> /en/signup'), hero);
  check('Intro: the cohort is accepting, so the second CTA is Apply to join -> /recruit', hero.includes(`Apply to join ${cohortName} -> /en/recruit`), hero);
  const order = await h2s(p);
  const idx = (re) => order.findIndex((t) => re.test(t));
  const parts = [/done together/i, /Meet the members/i, /community has shipped/i];
  check('Intro: activities, members, achievements in that order', parts.every((re) => idx(re) >= 0) && idx(parts[0]) < idx(parts[1]) && idx(parts[1]) < idx(parts[2]), order);
  check('Intro: no news section and no About section (the hero carries it)', !order.some((t) => /Latest news|Learn, build and move on Injective/.test(t)), order);
  const bountyAt = idx(/Active bounties/i);
  const banner = idx(/is recruiting members/i);
  check('Intro: the recruitment banner is the last section', banner === order.length - 1, order);
  if (bountyAt >= 0) {
    check('Intro: open bounties come after achievements, before the banner, and link to /bounties', bountyAt > idx(parts[2]) && bountyAt < banner && (await links(p, 'main a')).some((l) => l.endsWith('-> /en/bounties')), order);
    check('Intro: the bounty preview shows at least one bounty card', await p.eval(`document.querySelectorAll('main a[href*="/en/bounties/"]').length > 0`));
  } else console.log('Intro: no open bounty section (no active bounty seeded)');
  check('Intro: the stat block follows the zero rule', (await p.eval(`!!document.querySelector('main dl')`)) === !statsAllZero, { statsAllZero });
  check('Intro: no em dash', !text.includes('—'));
  clean(await report(p, 'Intro', {}), { signedOut: true });

  // a secondary link without an open cohort is the past activities
  await apiAs(adminToken, 'GET', '/admin/cohorts');
  await p.goto('/ko'); await sleep(900);
  const koTitle = await p.eval(`document.querySelector('main h1')?.innerText`);
  check('Intro (ko): community headline', /Injective 위에서 배우고, 만들고,\s*함께 움직이는 사람들\./.test(koTitle ?? ''), koTitle);

  // /bounties carries the moved hero
  await p.goto('/en/bounties'); await sleep(900);
  const bTitle = await p.eval(`document.querySelector('main h1')?.innerText`);
  check('/bounties: the hero headline moved here', /Complete bounties\. Collect proof\.\s*Own your track record\./.test(bTitle ?? ''), bTitle);
  const bText = await mainText(p);
  check('/bounties: the NFT portfolio card is here', bText.includes('ninja.inj'));
  check('/bounties: one h1 only', (await p.eval(`document.querySelectorAll('main h1').length`)) === 1);
  const bLinks = await links(p, 'main a');
  check('/bounties: Get Started -> signup and the how-applying link', bLinks.includes('Get Started -> /en/signup') && bLinks.some((l) => l.endsWith('-> /en/bounties/apply')), bLinks.slice(0, 8));
  check('/bounties: the list is still below the hero', bLinks.some((l) => l.includes(`/en/bounties/${seed.B1}`)), bLinks.slice(0, 12));
  check('/bounties: hero stats follow the zero rule', (await p.eval(`!!document.querySelector('main section:first-of-type dl')`)) === !statsAllZero, { statsAllZero });
  clean(await report(p, '/bounties signed out', {}), { signedOut: true });

  // titles and share tags
  for (const [path, re] of [['/en', /Injective Contributor Hub/], ['/ko', /Injective Contributor Hub/], ['/zh', /Injective Contributor Hub/], ['/ko/bounties', /바운티 마켓플레이스/], ['/en/bounties', /Bounty Marketplace/], ['/zh/bounties', /赏金市场/]]) {
    const html = await (await fetch(`${state.feOrigin}${path}`)).text();
    const t = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
    const og = /<meta property="og:title" content="([^"]*)"/.exec(html)?.[1] ?? '';
    check(`metadata ${path}: title and og:title use the new framing`, re.test(t) && re.test(og), { t, og });
  }
  await p.close();
}

// ---- finished user: /bounties hero CTA is My profile
{
  const p = await b.newPage(await b.newContext());
  await signIn(p, ids.BUILDER);
  await p.goto('/en/bounties'); await sleep(1200);
  const bLinks = await links(p, 'main section:first-of-type a');
  check('finished user: /bounties hero shows My profile, not Get Started', bLinks.some((l) => l.startsWith('My profile -> /en/members/')) && !bLinks.some((l) => l.startsWith('Get Started')), bLinks);
  await p.goto('/en'); await p.waitFor(`location.pathname==='/en/home'`, 8000);
  check('finished user: / goes to the home', (await p.url()).endsWith('/en/home'), await p.url());
  const logo = await p.eval(`document.querySelector('header a[aria-label="Ninja Labs home"]').getAttribute('href')`);
  check('finished user: the logo points at the home', logo === '/en/home', logo);
  clean(await report(p, 'finished /bounties and home', {}));
  await p.close();
}

// ---- in-between widths: nothing clipped on the changed screens
const WIDTHS = [340, 530, 700, 900, 1100];
const PROBE = `(${denseProbe})()`;
const SCREENS = [['out', '/'], ['out', '/about'], ['out', '/bounties'], ['user', '/home'], ['user', '/bounties'], ['user', '/about']];
let swept = 0;
const problems = [];
for (const locale of ['ko', 'en', 'zh']) {
  const pages = { out: await b.newPage(await b.newContext()), user: await b.newPage(await b.newContext()) };
  await signIn(pages.user, ids.BUILDER);
  for (const [st, route] of SCREENS) {
    const p = pages[st];
    await p.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await p.goto(`/${locale}${route === '/' ? '' : route}`);
    await sleep(900);
    for (const width of WIDTHS) {
      await p.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await sleep(120);
      const result = await p.eval(PROBE);
      swept += 1;
      for (const issue of result.issues) problems.push({ locale, st, route, width, kind: issue.kind, sig: issue.sig, text: issue.text, detail: issue.detail });
    }
  }
  for (const p of Object.values(pages)) await p.close();
}
for (const problem of problems.slice(0, 20)) check(`no ${problem.kind} on ${problem.locale} ${problem.st} ${problem.route} @${problem.width}`, false, problem);
check(`in-between widths: 0 layout problems over ${swept} page-widths (ko, en, zh; signed out and finished)`, problems.length === 0, problems.length);
b.close(); done('15 community-first landing');
