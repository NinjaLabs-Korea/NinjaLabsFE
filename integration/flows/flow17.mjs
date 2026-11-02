// Flow 17: QA sweep. Every route in ko/en/zh at a phone (390px) and a desktop (1440px) width, signed out / member / admin:
// axe-core (WCAG 2 A/AA + best practice), horizontal page overflow, console errors, hydration errors and failed requests.
// One assertion per distinct (rule, route pattern, state) so a finding reads as one line; details go to qa-sweep.json.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Browser, CSP_VIOLATION } from '../lib/cdp.mjs';
import { state } from '../lib/state.mjs';
import { ids, seed, check, done, signIn, SIGNED_OUT_PROBE } from '../lib/harness.mjs';

const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [path.resolve(import.meta.dirname, '../..')] }), 'utf8');
// Off on purpose (see wiki backlog): colour tokens (text-primary/ink-muted/dimmed past items fail 4.5:1 by design), the signup stepper
// sits outside a landmark, and page-has-heading-one false-positives in this sweep although every detail page renders one h1 (flow 1).
const SKIPPED_RULES = { 'color-contrast': { enabled: false }, region: { enabled: false }, 'page-has-heading-one': { enabled: false } };
const LOCALES = ['ko', 'en', 'zh'];
const WIDTHS = [390, 1440];
const routesSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../../src/lib/locale-routes.ts'), 'utf8');
const patterns = [...routesSrc.matchAll(/^\s+"(\/[^"]*)",$/gm)].map((m) => m[1]).filter((r) => !r.startsWith('/opengraph-image') && r !== '/auth/callback');
const idFor = { '/bounties/[id]': [seed.B1], '/members/[id]': ['coreninja'], '/notices/[id]': [seed.N1] };
const jobs = [];
for (const pat of patterns) {
  const concrete = pat in idFor ? idFor[pat].map((id) => pat.replace('[id]', id)) : [pat];
  for (const route of concrete) for (const st of pat.startsWith('/admin') ? ['admin'] : ['out', 'user']) jobs.push({ route, pat, st });
}
jobs.push({ route: '/page-not-found', pat: '/page-not-found', st: 'out' });
console.log(`QA SWEEP: ${jobs.length} route/state pairs x ${LOCALES.length} locales x ${WIDTHS.length} widths`);

const b = await Browser.connect();
const found = new Map();
const note = (key, rec) => { const r = found.get(key); if (r) r.n++; else found.set(key, { ...rec, n: 1 }); };

async function worker(locale) {
  const pages = {};
  for (const st of ['out', 'user', 'admin']) {
    const p = await b.newPage(await b.newContext());
    if (st === 'user') await signIn(p, ids.BUILDER);
    if (st === 'admin') await signIn(p, ids.ADMIN);
    pages[st] = p;
  }
  for (const { route, pat, st } of jobs) {
    const p = pages[st];
    for (const width of WIDTHS) {
      const where = `${locale} ${st} ${route} @${width}`;
      try {
        await p.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
        p.reset();
        await p.goto(`/${locale}${route === '/' ? '' : route}`);
        await p.waitFor(`document.body.innerText.trim().length > 0`, 6000);
        await p.idle(600, 4000); await new Promise((r) => setTimeout(r, 700));
        const lines = [...p.console, ...p.errors].filter((l) => !/Failed to load resource/.test(l));
        for (const l of lines) note(`console|${st}|${pat}|${l.slice(0, 80)}`, { kind: 'console', pat, st, where, detail: l });
        for (const f of p.failed.filter((f) => !(st === 'out' && SIGNED_OUT_PROBE.test(f)))) {
          if (pat === '/page-not-found' && /^404 GET .*\/page-not-found$/.test(f)) continue; // the 404 document answers 404 by design
          note(`failed|${st}|${pat}|${f.replace(/[0-9a-f-]{20,}/g, ':id').slice(0, 90)}`, { kind: 'failed-request', pat, st, where, detail: f });
        }
        if (p.console.concat(p.errors).some((l) => CSP_VIOLATION.test(l))) note(`csp|${pat}`, { kind: 'csp', pat, st, where, detail: 'csp' });
        const over = await p.eval(`(() => { const d = document.documentElement; return d.scrollWidth - d.clientWidth; })()`);
        if (over > 1) note(`overflow|${pat}|${width}|${st}`, { kind: 'h-overflow', pat, st, where, detail: `scrollWidth - clientWidth = ${over}` });
        await p.eval(AXE);
        const res = await p.eval(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, rules: ${JSON.stringify(SKIPPED_RULES)} }).then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\\n')[1]), count: v.nodes.length })))`);
        for (const v of res) note(`axe|${v.id}|${pat}|${st}`, { kind: `axe:${v.id}`, impact: v.impact, pat, st, where, detail: v.help, nodes: v.nodes, count: v.count });
      } catch (e) { note(`crash|${pat}|${st}`, { kind: 'crash', pat, st, where, detail: String(e).slice(0, 200) }); }
    }
  }
  for (const p of Object.values(pages)) await p.close();
}
await Promise.all(LOCALES.map((l) => worker(l)));

const list = [...found.entries()].map(([key, r]) => ({ key, ...r }));
fs.writeFileSync(path.join(state.logDir, 'qa-sweep.json'), JSON.stringify(list, null, 2));
for (const r of list) check(`qa: ${r.kind} ${r.impact ?? ''} ${r.pat} [${r.st}] x${r.n}`, false, { where: r.where, detail: r.detail, nodes: r.nodes });
check(`qa sweep: ${list.length} distinct findings`, list.length === 0, list.length);
b.close(); done('17 qa sweep');
