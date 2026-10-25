// Flow 6: admin CRUD in one session - member assign, bounty create (local-zone deadline), past-deadline edits
// (no reward and rewarded), notice create/publish/edit (published_at kept), highlight create/edit/clear link.
import { Browser, report } from '../lib/cdp.mjs';
import { sql, ids, check, clean, done, sleep, signIn, fillLabel, select, rowButton, mutations, mainText } from '../lib/harness.mjs';
const TZ = 'America/New_York';
const b = await Browser.connect(); const ctx = await b.newContext(); const p = await b.newPage(ctx);
await p.send('Emulation.setTimezoneOverride', { timezoneId: TZ });
await signIn(p, ids.ADMIN);
const clickSave = async (text = 'Save') => { await p.eval(`[...document.querySelectorAll('main button')].filter(b=>b.innerText.trim()===${JSON.stringify(text)}).pop().click()`); await sleep(1800); await p.idle(); };
const fmt = (iso) => new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ, timeZoneName: 'short' }).format(new Date(iso));

// ---- 6a member assignment
await p.goto('/en/admin/users'); await p.waitText('builderone');
await p.eval(`(()=>{const row=[...document.querySelectorAll('tr, article, li')].find(r=>r.innerText.includes('builderone') && r.querySelector('button')); [...row.querySelectorAll('button')].find(b=>/Assign/i.test(b.innerText)).click()})()`);
await p.waitFor(`!!document.querySelector('[role=dialog], dialog[open]')`, 5000);
await p.eval(`[...document.querySelector('[role=dialog], dialog[open]').querySelectorAll('button')].find(b=>b.innerText.trim()==='Dev').click()`);
await p.fill('[role=dialog] input[type=number], dialog[open] input[type=number]', '2');
await p.eval(`[...document.querySelector('[role=dialog], dialog[open]').querySelectorAll('button')].find(b=>b.innerText.trim()==='Confirm').click()`);
await sleep(1500); await p.idle();
clean(await report(p, 'assign member', { muts: mutations(p) }));
const member = sql(`select is_member||' '||member_role||' '||member_display_order from "user" where id='${ids.BUILDER}'`);
check('DB: builderone is a DEV member at order 2', member === 'true DEV 2' || member === 't DEV 2', member);
await p.goto('/en/members'); await sleep(600);
check('/members lists builderone', (await mainText(p)).includes('builderone'));
clean(await report(p, '/members after assign'));

// ---- 6b bounty create + local time zone
await p.goto('/en/admin/bounties'); await p.waitText('NEW BOUNTY FORM');
const mascotDeadline = sql(`select to_char(submission_deadline at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') from bounty where title='Design a mascot'`);
const mascotRow = await p.eval(`[...document.querySelectorAll('tr')].find(r=>r.innerText.includes('Design a mascot')).innerText.replace(/\\s+/g,' ')`);
check(`admin table deadline is in the browser zone (${TZ})`, mascotRow.includes(fmt(mascotDeadline)), `${mascotRow} | expected ${fmt(mascotDeadline)}`);
await fillLabel(p, 'Title', 'Integrate Injective EVM wallet'); await fillLabel(p, 'Sponsor', 'Helix');
const dl = new Date(Date.now() + 20 * 864e5); const pad = (n) => String(n).padStart(2, '0');
const local = `${dl.getFullYear()}-${pad(dl.getMonth() + 1)}-${pad(dl.getDate())}T18:00`;
await fillLabel(p, 'Deadline', local);
await p.fill('main form input[inputmode=decimal]', '25');
// "Dev" is preselected; picking "Design" must replace it (round-10 fix: the chips used to multi-toggle and save tags[0]).
await p.click('Design', { exact: true, selector: 'main form [role=group] button' });
const pressed = await p.eval(`[...document.querySelectorAll('main form [role=group] button[aria-pressed=true]')].map(b=>b.innerText.trim())`);
check('field chips are single-select (only Design pressed)', JSON.stringify(pressed) === '["Design"]', pressed);
await fillLabel(p, 'Description (markdown)', '## Integrate\nAdd wallet connect.');
await fillLabel(p, 'Submission guide', 'Working demo required.');
await fillLabel(p, 'Deliverables', 'Repo\nDemo URL'); await fillLabel(p, 'Review process', 'Helix team reviews.');
p.reset();
await clickSave('Create');
const muts1 = mutations(p); clean(await report(p, 'create bounty', { muts1 }));
check('create POST /admin/bounties 201', muts1.includes('POST /admin/bounties 201'), muts1);
const created = sql(`select b.id||'|'||b.sponsor_name||'|'||b.category||'|'||to_char(b.submission_deadline at time zone '${TZ}','YYYY-MM-DD"T"HH24:MI')||'|'||r.amount||'|'||r.display_symbol from bounty b join bounty_reward r on r.bounty_id=b.id where b.title='Integrate Injective EVM wallet'`).split('|');
check('DB: created bounty with sponsor/category DESIGN/reward 25 INJ', created[1] === 'Helix' && created[2] === 'DESIGN' && created[4] === '25000000000000000000' && created[5] === 'INJ', created);
check(`DB: deadline equals the value typed in ${TZ}`, created[3] === local, `${created[3]} vs ${local}`);
const newId = created[0];

// edit the past-deadline bounty without a reward
// The edit sends the loaded ISO deadline back untouched (ms precision; seed `now()` values carry microseconds).
const msDeadline = (where) => sql(`select to_char(date_trunc('milliseconds', submission_deadline) at time zone 'UTC','YYYY-MM-DD HH24:MI:SS.MS') from bounty where ${where}`);
const before = msDeadline(`title='Design a mascot'`);
await rowButton(p, 'Design a mascot', 'Edit');
await fillLabel(p, 'Title', 'Design a mascot v2'); p.reset();
await p.click('css:main form button[type=submit]'); await sleep(1800); await p.idle();
const muts2 = mutations(p); clean(await report(p, 'edit past-deadline (no reward)', { muts2 }));
check('edit PATCH 200', muts2.some((m) => /^PATCH \/admin\/bounties\/.+ 200$/.test(m)), muts2);
check('DB: mascot renamed, deadline unchanged (ms)', msDeadline(`title='Design a mascot v2'`) === before, `${before} -> ${msDeadline(`title='Design a mascot v2'`)}`);
check('DB: mascot still has no reward', sql(`select count(*) from bounty_reward r join bounty b on b.id=r.bounty_id where b.title='Design a mascot v2'`) === '0');

// edit a rewarded bounty whose deadline has passed (round-8 crash point)
sql(`update bounty set submission_deadline=now()-interval '1 day' where id='${newId}'`);
const before2 = msDeadline(`id='${newId}'`);
await p.goto('/en/admin/bounties'); await p.waitText('NEW BOUNTY FORM');
await rowButton(p, 'Integrate Injective EVM wallet', 'Edit');
const amountShown = await p.eval(`document.querySelector('main form input[inputmode=decimal]').value`);
check('edit form pre-fills reward amount 25', amountShown === '25', amountShown);
await fillLabel(p, 'Title', 'Integrate Injective EVM wallet v2'); p.reset();
await p.click('css:main form button[type=submit]'); await sleep(1800); await p.idle();
const muts3 = mutations(p); clean(await report(p, 'edit past-deadline (rewarded)', { muts3 }));
check('rewarded edit PATCH 200', muts3.some((m) => /^PATCH \/admin\/bounties\/.+ 200$/.test(m)), muts3);
const after2 = sql(`select b.title||'|'||r.amount from bounty b join bounty_reward r on r.bounty_id=b.id where b.id='${newId}'`) + '|' + (msDeadline(`id='${newId}'`) === before2);
check('DB: rewarded bounty renamed, deadline and reward unchanged', after2 === 'Integrate Injective EVM wallet v2|25000000000000000000|true', after2);

// ---- 6c notices
await p.goto('/en/admin/notices'); await p.waitText('NEW POST FORM');
await fillLabel(p, 'Title', 'Round 10 notice'); await select(p, 'Category', 'Events');
await fillLabel(p, 'Body', 'Body of **round 10** notice with a [link](https://injective.com).');
await select(p, 'Status', 'Published'); p.reset();
await clickSave();
const muts4 = mutations(p); clean(await report(p, 'notice create+publish', { muts4 }));
const n1 = sql(`select id||'|'||status||'|'||category||'|'||published_at||'|'||summary from notice where title='Round 10 notice'`).split('|');
check('DB: notice PUBLISHED / EVENT with published_at', n1[1] === 'PUBLISHED' && n1[2] === 'EVENT' && n1[3] !== '', n1);
check('DB: notice summary is plain text', n1[4] === 'Body of round 10 notice with a link.', n1[4]);
const listRow = await p.eval(`[...document.querySelectorAll('tr')].find(r=>r.innerText.includes('Round 10 notice'))?.innerText.replace(/\\s+/g,' ')`);
check('admin notice row shows a YYYY-MM-DD publish day', /\b\d{4}-\d{2}-\d{2}\b/.test(listRow ?? '') && !/T\d{2}:/.test(listRow ?? ''), listRow);
await sleep(1200);
await rowButton(p, 'Round 10 notice', 'Edit');
await fillLabel(p, 'Title', 'Round 10 notice edited'); p.reset();
await clickSave();
const muts5 = mutations(p); clean(await report(p, 'notice edit', { muts5 }));
const n2 = sql(`select title||'|'||status||'|'||published_at from notice where id='${n1[0]}'`).split('|');
check('DB: notice renamed, still PUBLISHED, published_at unchanged', n2[0] === 'Round 10 notice edited' && n2[1] === 'PUBLISHED' && n2[2] === n1[3], { before: n1[3], after: n2 });
await p.goto('/en/notices'); await sleep(600);
check('public /notices shows the edited notice', (await mainText(p)).includes('Round 10 notice edited'));
clean(await report(p, 'public notices'));

// ---- highlights
await p.goto('/en/admin/hall-of-fame'); await p.waitFor(`[...document.querySelectorAll('main label')].some(l=>l.innerText.trim().startsWith('Display order'))`);
await select(p, 'Type', 'Award'); await fillLabel(p, 'Title', 'Round 10 award'); await fillLabel(p, 'Description', 'Best integration test');
await fillLabel(p, 'Link', 'https://injective.com/award'); await fillLabel(p, 'Display order', '1');
await select(p, 'Visibility', 'Published');
p.reset();
await clickSave();
const muts6 = mutations(p); clean(await report(p, 'highlight create', { muts6 }));
const h1 = sql(`select id||'|'||type||'|'||coalesce(link_url,'NULL')||'|'||display_order||'|'||is_published from platform_highlight where title='Round 10 award'`).split('|');
check('DB: highlight AWARD with link, order 1, published', h1[1] === 'AWARD' && h1[2] === 'https://injective.com/award' && h1[3] === '1' && h1[4] === 'true', h1);
await rowButton(p, 'Round 10 award', 'Edit');
await fillLabel(p, 'Title', 'Round 10 award edited'); await fillLabel(p, 'Link', ''); p.reset();
await clickSave();
const muts7 = mutations(p); clean(await report(p, 'highlight edit + clear link', { muts7 }));
const h2 = sql(`select title||'|'||coalesce(link_url,'NULL') from platform_highlight where id='${h1[0]}'`);
check('DB: highlight renamed and link cleared to NULL', h2 === 'Round 10 award edited|NULL', h2);
await p.goto('/en/hall-of-fame'); await sleep(600);
check('public Hall of Fame shows the edited highlight', (await mainText(p)).includes('Round 10 award edited'));
clean(await report(p, 'public hall of fame'));
b.close(); done('6 admin CRUD');
