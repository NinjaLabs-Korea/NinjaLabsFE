// Flow 14: dense-width layout audit. Every width from 320 to 1440 px in 20 px steps (61 widths), in ko, en and zh, signed out /
// finished user / admin, hunts for clipped content, icons wrapped away from their label, horizontal page overflow,
// character-per-line text and overlapping or covered controls (probe: lib/layout-audit.mjs). The target is 0 hits.
//
//   default            a quick set: the landing hero, the badge-heavy public screens and a few signed-in / admin screens
//   NINJA_IT_SWEEP=full  every route in src/lib/locale-routes.ts for every state it applies to (about 30+ minutes)
//   NINJA_IT_SWEEP_STEP  width step (default 20), NINJA_IT_SWEEP_ROUTES  regex filter on the route path
//
// One distinct problem = kind + element signature; the first sighting gets an outlined screenshot in
// <log dir>/shots/dense__<n>__<kind>__<route>__<locale>__<state>__<width>.png and every key is one assertion.
import fs from 'node:fs';
import path from 'node:path';
import { Browser } from '../lib/cdp.mjs';
import { state } from '../lib/state.mjs';
import { denseProbe } from '../lib/layout-audit.mjs';
import { ids, seed, check, done, sleep, signIn, apiAs, tokenFor } from '../lib/harness.mjs';

const SHOTS = path.join(state.logDir, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const FULL = process.env.NINJA_IT_SWEEP === 'full';
const STEP = Number(process.env.NINJA_IT_SWEEP_STEP ?? 20);
const ROUTE_FILTER = process.env.NINJA_IT_SWEEP_ROUTES ? new RegExp(process.env.NINJA_IT_SWEEP_ROUTES) : null;
const WIDTHS = []; for (let w = 320; w <= 1440; w += STEP) WIDTHS.push(w);
const LOCALES = ['ko', 'en', 'zh'];
const b = await Browser.connect();
const adminToken = tokenFor(ids.ADMIN, true);

// ---- data: an open cohort, an application (admin), long titles so wrapping is exercised
let longBounty = null, longNotice = null;
{
  const [, listBody] = await apiAs(adminToken, 'GET', '/admin/cohorts');
  const cohorts = JSON.parse(listBody);
  let open = cohorts.find((c) => c.status === 'OPEN');
  if (!open) {
    const target = cohorts[0];
    if (target) await apiAs(adminToken, 'POST', `/admin/cohorts/${target.id}/transition`, { to: 'OPEN' });
    else {
      const [, made] = await apiAs(adminToken, 'POST', '/admin/cohorts', { name: 'Dense Cohort', description: 'Ninja Labs 모집 안내입니다.\n개발자, 마케터, 리서처, 크리에이터를 찾아요.', closesAt: new Date(Date.now() + 20 * 864e5).toISOString() });
      await apiAs(adminToken, 'POST', `/admin/cohorts/${JSON.parse(made).id}/transition`, { to: 'OPEN' });
    }
  }
  const [, nowOpen] = await apiAs(adminToken, 'GET', '/admin/cohorts');
  open = JSON.parse(nowOpen).find((c) => c.status === 'OPEN');
  check('setup: a cohort is open', !!open, open?.name);
  await apiAs(adminToken, 'POST', `/cohorts/${open.id}/applications`, { displayName: 'Ops 운영자 (긴 이름을 가진 지원자의 이름입니다)', telegram: '@ops_admin', twitter: '@ops_admin', web3Experience: 'GT_3Y', activityType: 'BIZDEV', interestAreas: ['BIZDEV', 'DEVELOPER'], intro: 'Injective 위에서 대시보드를 만들고 싶습니다. '.repeat(4) });
  const [bs, bBody] = await apiAs(adminToken, 'POST', '/admin/bounties', {
    title: 'Build an Injective cross-chain analytics dashboard with extremely-long-unbroken-token-that-keeps-going 인젝티브 위에서 동작하는 긴 제목의 바운티',
    sponsorName: 'A Very Long Sponsor Name Foundation Korea', summary: 'A long summary line that should wrap nicely in cards at every width without being cut off by the container. '.repeat(2),
    description: '## Goal\nBuild it.', requirements: '- React', evaluationCriteria: '- Quality', category: 'DEV', applicationRequired: true, submissionMode: 'DIRECT', maxWinners: 3,
    submissionDeadline: new Date(Date.now() + 9 * 864e5).toISOString(),
    reward: { tokenType: 'NATIVE', tokenDenom: 'inj', displaySymbol: 'INJ', amount: '123456789000000000000000' },
  });
  if (bs < 300) { longBounty = JSON.parse(bBody).id; await apiAs(adminToken, 'POST', `/admin/bounties/${longBounty}/transition`, { to: 'OPEN' }); }
  const [ns, nBody] = await apiAs(adminToken, 'POST', '/admin/notices', { title: 'NinjaLabs 서울 빌더 밋업 후기와 다음 해커톤 일정 안내 (긴 제목 테스트 long-title-without-spaces-abcdefghijklmnopqrstuvwxyz)', summary: '긴 요약 문장입니다. '.repeat(10), body: '# 후기\n긴 본문입니다.', category: 'EVENT', publish: true });
  if (ns < 300) longNotice = JSON.parse(nBody).id;
  check('setup: long-title bounty and notice created', !!longBounty && !!longNotice, { bs, ns });
}

// ---- routes: from src/lib/locale-routes.ts, so a new page joins the sweep automatically
const routesSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../../src/lib/locale-routes.ts'), 'utf8');
const patterns = [...routesSrc.matchAll(/^\s+"(\/[^"]*)",$/gm)].map((m) => m[1]);
const idFor = { '/bounties/[id]': [seed.B1, longBounty], '/members/[id]': ['coreninja'], '/notices/[id]': [seed.N1, longNotice] };
const concrete = [];
for (const pat of patterns) {
  if (pat.startsWith('/opengraph-image')) continue;
  if (pat in idFor) for (const id of idFor[pat]) { if (id) concrete.push(pat.replace('[id]', id)); }
  else concrete.push(pat);
}
concrete.push('/page-not-found');
const isAdminRoute = (r) => r.startsWith('/admin');
const QUICK = new Set(['/', '/bounties', '/bounties/apply', '/home', '/recruit', '/about', '/notices', '/account', '/signup', '/hall-of-fame', '/members', '/admin/recruitment', '/admin/bounties']);
const QUICK_PREFIX = [`/bounties/${seed.B1}`, `/notices/${longNotice}`];
const jobs = [];
for (const route of concrete) {
  if (ROUTE_FILTER && !ROUTE_FILTER.test(route)) continue;
  if (!FULL && !QUICK.has(route) && !QUICK_PREFIX.includes(route)) continue;
  const states = isAdminRoute(route) ? ['admin'] : route === '/auth/callback' ? ['out'] : ['out', 'user'];
  if (FULL && !isAdminRoute(route) && (route === '/' || route === '/home' || route === '/account')) states.push('admin');
  for (const st of states) jobs.push({ route, st });
}
console.log(`SWEEP ${FULL ? 'full' : 'quick'}: ${jobs.length} route/state pairs x ${LOCALES.length} locales x ${WIDTHS.length} widths`);

// ---- sweep
const found = new Map(); // key -> { kind, sig, text, detail, widths:Set, where:Set }
let shotNo = 0;
const PROBE = `(${denseProbe})()`;
const slug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40);

async function sweepPage(p, locale, st, route) {
  const url = `/${locale}${route === '/' ? '' : route}`;
  await p.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await p.goto(url);
  await sleep(500);
  for (const width of WIDTHS) {
    await p.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(90);
    let result;
    try { result = await p.eval(PROBE); } catch (e) { check(`probe ran ${url} ${width}`, false, String(e).slice(0, 200)); continue; }
    for (const issue of result.issues) {
      const key = `${issue.kind}|${issue.sig}`;
      let rec = found.get(key);
      if (!rec) {
        rec = { key, kind: issue.kind, sig: issue.sig, text: issue.text, detail: issue.detail, widths: new Set(), where: new Set(), shot: null, first: `${locale} ${st} ${url} @${width}` };
        found.set(key, rec);
        if (shotNo < 120) {
          shotNo += 1;
          try {
            await p.eval(`(() => { const s = document.createElement('style'); s.id = 'sweep-outline'; s.textContent = '[data-sweep-hit]{outline:2px solid #ff2d55 !important;outline-offset:1px} [data-sweep-hit=clipper]{outline-color:#f5a623 !important}'; document.head.appendChild(s); document.querySelector('[data-sweep-hit]:not([data-sweep-hit=clipper])')?.scrollIntoView({ block: 'center' }); })()`);
            await sleep(120);
            const { data } = await p.send('Page.captureScreenshot', { format: 'png' });
            rec.shot = path.join(SHOTS, `dense__${String(shotNo).padStart(3, '0')}__${issue.kind}__${slug(route)}__${locale}__${st}__${width}.png`);
            fs.writeFileSync(rec.shot, Buffer.from(data, 'base64'));
            await p.eval(`document.getElementById('sweep-outline')?.remove(); window.scrollTo(0, 0)`);
          } catch (e) { console.log('shot failed', String(e).slice(0, 120)); }
        }
      }
      rec.widths.add(width);
      rec.where.add(`${locale}:${st}:${route}`);
    }
  }
}

async function worker(locale) {
  const pages = {};
  for (const st of ['out', 'user', 'admin']) {
    if (!jobs.some((j) => j.st === st)) continue;
    const p = await b.newPage(await b.newContext());
    if (st === 'user') await signIn(p, ids.BUILDER);
    if (st === 'admin') await signIn(p, ids.ADMIN);
    pages[st] = p;
  }
  for (const { route, st } of jobs) {
    try { await sweepPage(pages[st], locale, st, route); } catch (e) { check(`sweep ${locale} ${st} ${route} completed`, false, String(e).slice(0, 200)); }
  }
  for (const p of Object.values(pages)) await p.close();
}
await Promise.all(LOCALES.map((l) => worker(l)));

// ---- report: one assertion per distinct problem, plus the headline count
const list = [...found.values()].sort((x, y) => x.kind.localeCompare(y.kind));
const summary = list.map((r) => ({ kind: r.kind, sig: r.sig, text: r.text, detail: r.detail, widths: `${Math.min(...r.widths)}-${Math.max(...r.widths)} (${r.widths.size})`, where: [...r.where].slice(0, 6), first: r.first, shot: r.shot }));
fs.writeFileSync(path.join(state.logDir, 'dense-sweep.json'), JSON.stringify(summary, null, 2));
for (const r of summary) check(`dense: no ${r.kind} (${r.sig})`, false, r);
check(`dense sweep: ${list.length} distinct problems (hits must be 0) over ${jobs.length * LOCALES.length * WIDTHS.length} page-widths`, list.length === 0, list.length);
console.log(`SWEEP RESULT distinct=${list.length}`);
// the hero badge keeps icon and label on one line (the regression this flow was written for)
{
  const p = await b.newPage(await b.newContext());
  for (const locale of LOCALES) for (const width of [320, 530, 1440]) {
    await p.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await p.goto(`/${locale}`);
    const r = await p.eval(`(() => { const img = document.querySelector('main img[src*="injective-icon"], section img[src*="injective-icon"]'); const badge = img?.closest('span.rounded-full'); if (!badge) return null; const i = img.getBoundingClientRect(), t = badge.getBoundingClientRect(); return { iconMid: i.top + i.height / 2, top: t.top, bottom: t.bottom, h: t.height }; })()`);
    check(`hero badge ${locale} ${width}px: icon and label on one line inside the pill`, !!r && r.iconMid > r.top && r.iconMid < r.bottom && r.h < 40, r);
  }
  await p.close();
}
b.close(); done('14 dense-width layout audit');
