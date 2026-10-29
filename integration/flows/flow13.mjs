// Flow 13: every community / recruitment screen in Korean at 375, 768 and 1280 px, signed out / finished / admin (an unfinished sign-up is sent to its onboarding step from every page, so it has no community screen):
// no horizontal overflow, no character-per-line wrapping, nothing clipped outside the viewport, and a screenshot of each.
// Screenshots go to <log dir>/shots/<screen>__<state>__<width>.png.
import fs from 'node:fs';
import path from 'node:path';
import { Browser, report } from '../lib/cdp.mjs';
import { state } from '../lib/state.mjs';
import { sql, ids, check, clean, done, sleep, signIn, apiAs, tokenFor } from '../lib/harness.mjs';

const SHOTS = path.join(state.logDir, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const WIDTHS = [375, 768, 1280];
const b = await Browser.connect();
const adminToken = tokenFor(ids.ADMIN, true);

// ---- data the screens need: an open cohort, an application of the builder, an event date on the event notice
sql(`update notice set event_date='2026-06-18' where title='Injective hackathon'`);
{
  const [, listBody] = await apiAs(adminToken, 'GET', '/admin/cohorts');
  const cohorts = JSON.parse(listBody);
  let open = cohorts.find((c) => c.status === 'OPEN');
  if (!open) {
    const target = cohorts[0];
    if (target) await apiAs(adminToken, 'POST', `/admin/cohorts/${target.id}/transition`, { to: 'OPEN' });
    else {
      const [, made] = await apiAs(adminToken, 'POST', '/admin/cohorts', { name: 'Responsive Cohort', description: 'Ninja Labs 모집 안내입니다.\n개발자, 마케터, 리서처, 크리에이터를 찾아요.', closesAt: new Date(Date.now() + 20 * 864e5).toISOString() });
      await apiAs(adminToken, 'POST', `/admin/cohorts/${JSON.parse(made).id}/transition`, { to: 'OPEN' });
    }
  }
  const [, nowOpen] = await apiAs(adminToken, 'GET', '/admin/cohorts');
  open = JSON.parse(nowOpen).find((c) => c.status === 'OPEN');
  check('setup: a cohort is open', !!open, open?.name);
  await apiAs(tokenFor(ids.BUILDER), 'POST', `/cohorts/${open.id}/applications`, { displayName: '김닌자 (긴 이름을 가진 지원자의 이름입니다)', telegram: '@ninja_builder', twitter: '@ninja_builder', web3Experience: 'Y1_3', activityType: 'OTHER', activityTypeOther: '프로덕트 디자이너 겸 커뮤니티 운영', interestAreas: ['DEVELOPER', 'KOL', 'OTHER'], interestOther: '온체인 데이터 시각화', intro: 'Injective 위에서 대시보드를 만들고 새로운 빌더들이 빠르게 첫 작업을 낼 수 있도록 돕고 싶습니다. '.repeat(3) });
  await apiAs(tokenFor(ids.ADMIN, true), 'POST', `/cohorts/${open.id}/applications`, { displayName: 'Ops', telegram: '@ops_admin', twitter: '@ops_admin', web3Experience: 'GT_3Y', activityType: 'BIZDEV', interestAreas: ['BIZDEV'], intro: 'ops' });
}

/** Returns the layout problems of the current page: overflow beyond the viewport and text squeezed to a few characters per line. */
const LAYOUT = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = { vw, scrollWidth: document.documentElement.scrollWidth, overflowing: [], squeezed: [] };
  const inScroller = (el) => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' && n.scrollWidth > n.clientWidth + 1) return true; } return false; };
  for (const el of document.querySelectorAll('body *')) {
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.position === 'fixed' || cs.display === 'contents') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 && !inScroller(el) && !el.closest('dialog:not([open]), .sr-only, [aria-hidden=true]')) {
      if (out.overflowing.length < 6) out.overflowing.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 60) + ' right=' + Math.round(r.right));
    }
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\\s+/g, ' ').trim();
    if (own.length >= 8 && !el.closest('.sr-only') && !inScroller(el)) {
      // Only this element's own text nodes (a label also contains its input and hint, which are laid out on other lines).
      const tops = new Set();
      for (const node of el.childNodes) {
        if (node.nodeType !== 3 || !node.textContent.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        for (const q of range.getClientRects()) if (q.width > 0) tops.add(Math.round(q.top));
      }
      const lines = Math.max(tops.size, 1);
      if (own.length / lines < 3.5 && lines > 3 && out.squeezed.length < 6) out.squeezed.push(own.slice(0, 30) + ' (' + lines + ' lines)');
    }
  }
  return out;
})()`;

async function shoot(p, screen, who, width) {
  const { data } = await p.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const file = path.join(SHOTS, `${screen}__${who}__${width}.png`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}

/** Visits `url` at every width, asserts the layout and writes a screenshot. `prepare` runs after load (open a dialog ...). */
async function screen(p, name, who, url, { waitText, prepare, label = name } = {}) {
  for (const width of WIDTHS) {
    await p.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await p.goto(url);
    if (waitText) await p.waitText(waitText, 10000);
    await sleep(400);
    if (prepare) await prepare(p, width);
    await sleep(300);
    const layout = await p.eval(LAYOUT);
    const tag = `${label} [${who}] ${width}px`;
    check(`${tag}: no horizontal page scroll`, layout.scrollWidth <= layout.vw + 1, { scrollWidth: layout.scrollWidth, vw: layout.vw });
    check(`${tag}: nothing sticks out of the viewport`, layout.overflowing.length === 0, layout.overflowing);
    check(`${tag}: no character-per-line wrapping`, layout.squeezed.length === 0, layout.squeezed);
    const file = await shoot(p, name, who, width);
    console.log(`SHOT ${file}`);
    clean(await report(p, tag), { signedOut: who === 'signed-out' || who === 'unfinished' });
  }
}

// ---- signed out
{
  const p = await b.newPage(await b.newContext());
  await screen(p, 'intro', 'signed-out', '/ko', { waitText: '함께 해 온 활동' });
  await screen(p, 'about', 'signed-out', '/ko/about', { waitText: '함께 해 온 활동' });
  await screen(p, 'bounties', 'signed-out', '/ko/bounties', { waitText: '바운티를 완료하고' });
  await screen(p, 'recruit', 'signed-out', '/ko/recruit', { waitText: '로그인' });
  await p.close();
}

// ---- finished user
{
  const p = await b.newPage(await b.newContext());
  await signIn(p, ids.BUILDER);
  await screen(p, 'home', 'finished', '/ko/home', { waitText: '님, 안녕하세요' });
  await screen(p, 'about', 'finished', '/ko/about', { waitText: '함께 해 온 활동' });
  await screen(p, 'bounties', 'finished', '/ko/bounties', { waitText: '바운티를 완료하고' });
  await screen(p, 'recruit-status', 'finished', '/ko/recruit', { waitText: '심사 대기' });
  await screen(p, 'account', 'finished', '/ko/account', { waitText: '기수 지원 현황' });
  await screen(p, 'notices', 'finished', '/ko/notices', { waitText: '행사일' });
  // the application form (withdraw the builder's application first so the form shows), with validation errors visible
  const [, mineBody] = await apiAs(tokenFor(ids.BUILDER), 'GET', '/cohorts/applications/me');
  const mine = JSON.parse(mineBody)[0];
  if (mine) sql(`update cohort_application set status='WITHDRAWN' where id='${mine.id}'`); // whatever state flow 12 left it in
  await screen(p, 'recruit-form', 'finished', '/ko/recruit', { waitText: '지원서 보내기', prepare: async (page) => {
    const errors = await page.eval(`document.querySelectorAll('main [role=alert]').length`);
    check('recruit-form: a pristine form shows no error text', errors === 0, errors);
  } });
  await screen(p, 'recruit-form-errors', 'finished', '/ko/recruit', {
    waitText: '지원서 보내기',
    prepare: async (page) => {
      await page.waitFor(`[...document.querySelectorAll('main button')].some(b=>b.innerText.trim()==='지원서 보내기')`, 8000);
      await page.eval(`[...document.querySelectorAll('main button')].find(b=>b.innerText.trim()==='지원서 보내기')?.click()`); await sleep(400);
    },
  });
  await p.close();
}

// ---- admin
{
  const p = await b.newPage(await b.newContext());
  await signIn(p, ids.ADMIN);
  await screen(p, 'admin-recruitment', 'admin', '/ko/admin/recruitment', {
    waitText: '접수 기간',
    prepare: async (page) => {
      await page.eval(`[...document.querySelectorAll('tr')].find(r=>r.querySelector('td'))?.querySelector('button')?.click()`);
      await sleep(1200);
    },
  });
  await screen(p, 'admin-recruitment-review', 'admin', '/ko/admin/recruitment', {
    waitText: '접수 기간',
    prepare: async (page, width) => {
      await page.eval(`[...document.querySelectorAll('tr')].find(r=>r.querySelector('td'))?.querySelector('button')?.click()`);
      await sleep(1200);
      await page.eval(`[...document.querySelectorAll('main tbody tr')].map(r=>[...r.querySelectorAll('button')].find(b=>/심사|결정 변경/.test(b.innerText))).find(Boolean)?.click()`);
      await sleep(600);
      const inside = await page.eval(`(()=>{const d=document.querySelector('dialog[open]'); if(!d) return 'NO_DIALOG'; const r=d.getBoundingClientRect(); return r.left>=-1 && r.right<=innerWidth+1 && r.top>=-1 ? 'OK' : 'CLIPPED '+Math.round(r.left)+','+Math.round(r.right)+','+Math.round(r.top)})()`);
      check(`review dialog stays inside the viewport (${width}px)`, inside === 'OK', inside);
    },
  });
  await screen(p, 'admin-notices', 'admin', '/ko/admin/notices', { waitText: '행사 날짜' });
  await p.close();
}
b.close(); done('13 responsive community screens');
