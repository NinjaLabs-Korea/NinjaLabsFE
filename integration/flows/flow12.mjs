// Flow 12: member recruitment end to end. Admin creates and opens a cohort in the UI, a builder applies (home banner ->
// /recruit form), sees the status on the home and /account, edits it, the admin reviews it, the applicant sees the result
// (never the note), the admin closes the cohort. Also: the hub stays open to finished users, return path after sign-in,
// onboarding gate, withdraw/reapply and the CSV export. The admin also edits the cohort's application questions in the UI (add a
// required short answer, rename the interest question, remove the Web3 experience question); the applicant sees exactly those
// questions, the review dialog and the CSV show the answers, and a legacy-shape application stored before the edit (inserted directly: the BE rejects the old body since BE #49) stays
// readable. An unfinished sign-up that started on /recruit comes back to /recruit without the get-started menu.
import { Browser, report } from '../lib/cdp.mjs';
import { sql, ids, check, clean, done, sleep, signIn, signInWithReturn, apiAs, tokenFor, fillLabel, rowButton, dialogButton, chip, select, mutations, mainText, API } from '../lib/harness.mjs';

const b = await Browser.connect();
const NAME = 'IT Spring Cohort';
const adminToken = tokenFor(ids.ADMIN, true);
// Flow 2 completes the seeded step-3 user, so this flow makes its own unfinished sign-up (profile step still owed).
const INCOMPLETE = sql(`INSERT INTO "user"(google_id,email,nickname,bio,onboarding_step) VALUES ('g-inc-12','inc12@test.dev','user_inc120001','',3) RETURNING id`).split(String.fromCharCode(10))[0];
const INCOMPLETE2 = sql(`INSERT INTO "user"(google_id,email,nickname,bio,onboarding_step) VALUES ('g-inc-12b','inc12b@test.dev','user_inc120002','',3) RETURNING id`).split(String.fromCharCode(10))[0];
const CORE = sql(`select id from "user" where nickname='coreninja'`);
/** The control of the first label starting with \`txt\` inside the question editor item number \`item\` (1-based); tagged for \`fill\`. */
async function editorControl(p, item, txt) {
  const ok = await p.eval(`(()=>{document.querySelectorAll('[data-fill]').forEach(e=>e.removeAttribute('data-fill'));
    const li=document.querySelectorAll('section[aria-labelledby^="questions-"] > ol > li')[${item - 1}]; if(!li) return false;
    const l=[...li.querySelectorAll('label')].find(l=>l.innerText.trim().startsWith(${JSON.stringify(txt)})); const el=l && l.querySelector('input,textarea'); if(!el) return false; el.dataset.fill='1'; return true})()`);
  if (!ok) throw new Error(`editor control not found: question ${item} / ${txt}`);
  return '[data-fill="1"]';
}
const clickSave = async (page) => { const since = page.requests.length; await page.eval(`[...document.querySelectorAll('main button')].filter(b=>b.innerText.trim()==='Save').pop().click()`); await page.waitForMutation({ since }); await page.idle(); };

// ---- admin: create and open a cohort
const adminCtx = await b.newContext(); const adminPage = await b.newPage(adminCtx);
await signIn(adminPage, ids.ADMIN);
await adminPage.goto('/en/admin/recruitment'); await adminPage.waitText('Create a cohort', 10000);
clean(await report(adminPage, 'admin recruitment (empty)'));
check('admin recruitment: tab is active and the empty state is honest', (await mainText(adminPage)).includes('No cohorts yet'));
await fillLabel(adminPage, 'Name', NAME);
await fillLabel(adminPage, 'Description', 'Integration test cohort.\nSecond line.');
adminPage.reset();
await clickSave(adminPage);
const created = mutations(adminPage);
clean(await report(adminPage, 'admin created cohort', { created }));
check('admin: POST /admin/cohorts 201', created.includes('POST /admin/cohorts 201'), created);
check('DB: cohort exists as DRAFT with its description', sql(`select status||'|'||description from cohort where name='${NAME}'`) === 'DRAFT|Integration test cohort.\nSecond line.', sql(`select status from cohort where name='${NAME}'`));
const cohortId = sql(`select id from cohort where name='${NAME}'`);
check('draft cohort is invisible to the public API', (await fetch(`${API}/cohorts/current`).then((r) => r.text())) === 'null');
await rowButton(adminPage, NAME, 'Open'); adminPage.reset();
await dialogButton(adminPage, 'Open recruitment'); await adminPage.waitForMutation(); await adminPage.idle();
check('DB: cohort is OPEN after the confirmed transition', sql(`select status from cohort where id='${cohortId}'`) === 'OPEN');
check('DB: audit rows for create and open', sql(`select string_agg(action, ',' order by created_at) from audit_log where entity_id='${cohortId}'`) === 'COHORT_CREATED,COHORT_OPENED');

check('DB: the new cohort starts with the two default questions', sql(`select string_agg(q->>'id', ',') from cohort, jsonb_array_elements(questions) q where id='${cohortId}'`) === 'web3_experience,interest_areas');
check('public API carries the questions', JSON.parse(await fetch(`${API}/cohorts/current`).then((r) => r.text())).questions.map((q) => q.id).join() === 'web3_experience,interest_areas');

// ---- a legacy-shape application (written by an older FE before BE #49) before the questions are edited.
// The BE no longer accepts the old body (DTO 400), so the old row is inserted directly, like the BE db/e2e specs do.
{
  const [st, body] = await apiAs(tokenFor(CORE), 'POST', `/cohorts/${cohortId}/applications`, { displayName: 'Core Legacy', telegram: '@core_legacy', twitter: '@core_legacy', web3Experience: 'GT_3Y', activityType: 'STUDENT', interestAreas: ['DEVELOPER'], intro: 'I applied with the old form.' });
  check('legacy-shape body: POST is rejected with 400 and writes nothing', st === 400 && /web3Experience should not exist/.test(body) && sql(`select count(*) from cohort_application where user_id='${CORE}' and cohort_id='${cohortId}'`) === '0', [st, body.slice(0, 160)]);
  sql(`insert into cohort_application (cohort_id, user_id, display_name, telegram, twitter, intro, web3_experience, activity_type, activity_type_other, interest_areas, interest_other) values ('${cohortId}', '${CORE}', 'Core Legacy', '@core_legacy', '@core_legacy', 'I applied with the old form.', 'GT_3Y', 'STUDENT', null, array['DEVELOPER']::text[], null)`);
  check('DB: stored in the legacy columns with no answers', sql(`select web3_experience||'|'||activity_type||'|'||jsonb_array_length(answers) from cohort_application where user_id='${CORE}' and cohort_id='${cohortId}'`) === 'GT_3Y|STUDENT|0');
  const [mst, mine] = await apiAs(tokenFor(CORE), 'GET', '/cohorts/applications/me');
  const legacy = mst === 200 ? JSON.parse(mine).find((a) => a.cohortId === cohortId || a.cohort_id === cohortId) : null;
  check('API: the legacy row reads back with synthesized answers', legacy?.answers?.map((a) => a.questionId).join() === 'web3_experience,interest_areas,activity_type', [mst, mine.slice(0, 200)]);
}

// ---- admin edits the application questions in the UI
await rowButton(adminPage, NAME, 'Questions'); await adminPage.waitText(`${NAME} application questions`, 8000);
clean(await report(adminPage, 'admin question editor'));
check('editor: shows the two default questions and the fixed-fields note', await adminPage.eval(`document.querySelectorAll('section[aria-labelledby^="questions-"] > ol > li').length`) === 2 && (await mainText(adminPage)).includes('Name, Telegram, X and introduction are always collected'));
await adminPage.fill(await editorControl(adminPage, 2, 'Question (Korean)'), '관심 분야');
await adminPage.fill(await editorControl(adminPage, 2, 'Question (English'), 'Areas of interest');
await adminPage.eval(`document.querySelector('button[aria-label="Delete question 1"]').click()`); await sleep(300);
await dialogButton(adminPage, 'Delete question');
check('editor: removing the first question leaves one', await adminPage.eval(`document.querySelectorAll('section[aria-labelledby^="questions-"] > ol > li').length`) === 1);
await adminPage.click('Add question', { exact: true });
await adminPage.fill(await editorControl(adminPage, 2, 'Question (Korean)'), 'GitHub 주소');
await adminPage.fill(await editorControl(adminPage, 2, 'Question (English'), 'GitHub URL');
await adminPage.eval(`[...document.querySelectorAll('section[aria-labelledby^="questions-"] > ol > li')][1].querySelector('input[type=checkbox]').click()`);
check('editor: unsaved changes are announced', (await mainText(adminPage)).includes('You have unsaved changes.'));
adminPage.reset();
await adminPage.click('Save questions', { exact: true }); await adminPage.waitForMutation(); await adminPage.idle();
check('admin: PUT /admin/cohorts/:id/questions 200', mutations(adminPage).some((m) => new RegExp(`^PUT /admin/cohorts/${cohortId}/questions 200$`).test(m)), mutations(adminPage));
clean(await report(adminPage, 'admin saved questions'));
const stored = sql(`select string_agg((q->>'id')||'='||(q->'label'->>'ko')||'/'||coalesce(q->'label'->>'en','')||'/'||(q->>'type')||'/'||(q->>'required'), ';') from cohort, jsonb_array_elements(questions) q where id='${cohortId}'`);
check('DB: interest_areas kept its id and got the new label, web3_experience is gone, the new question is a required SHORT_TEXT', /^interest_areas=관심 분야\/Areas of interest\/MULTI_CHOICE\/true;q_[0-9a-f]{12}=GitHub 주소\/GitHub URL\/SHORT_TEXT\/true$/.test(stored), stored);
check('DB: audit row COHORT_QUESTIONS_UPDATED', sql(`select count(*) from audit_log where entity_id='${cohortId}' and action='COHORT_QUESTIONS_UPDATED'`) === '1');
const GITHUB_ID = sql(`select q->>'id' from cohort, jsonb_array_elements(questions) q where id='${cohortId}' and q->>'type'='SHORT_TEXT'`);
check('DB: the legacy application is untouched by the edit', sql(`select web3_experience||'|'||jsonb_array_length(answers) from cohort_application where user_id='${CORE}' and cohort_id='${cohortId}'`) === 'GT_3Y|0');

// ---- a visitor sees the banner and is sent to sign in with a return path
{
  const p = await b.newPage(await b.newContext());
  await p.goto('/en'); await p.waitText(`${NAME} is recruiting members`, 8000);
  clean(await report(p, 'signed-out Intro with banner'), { signedOut: true });
  check('signed out: Intro carries the recruitment banner with a link to /recruit', (await p.eval(`[...document.querySelectorAll('main a')].some(a=>a.innerText.trim()==='Apply now' && new URL(a.href).pathname==='/en/recruit')`)));
    const intro = await p.text();
  check('signed out: Intro shows the community sections', /Past activities/i.test(intro) && /Recent achievements/i.test(intro) && /Meet the members/i.test(intro), intro.slice(0, 200));
  const sectionOrder = await p.eval(`[...document.querySelectorAll('main h2')].filter(e=>e.getClientRects().length).map(e=>e.innerText.trim())`);
  const at = (re) => sectionOrder.findIndex((t) => re.test(t));
  check('signed out: the recruitment banner comes before the past activities', at(/is recruiting members/i) >= 0 && at(/is recruiting members/i) < at(/done together/i), sectionOrder);
  await p.goto('/en/recruit'); await p.waitText('Sign in to apply', 8000);
  const link = await p.eval(`(()=>{const a=[...document.querySelectorAll('main a')].find(a=>a.innerText.trim()==='Sign in and apply'); return a && a.getAttribute('href')})()`);
  check('signed out: /recruit shows the cohort and a sign-in link carrying returnTo', link === '/en/signup?returnTo=%2Frecruit', link);
  check('signed out: no form until signed in', !(await p.eval(`!!document.querySelector('form')`)));
  clean(await report(p, 'signed-out /recruit'), { signedOut: true });
  await p.goto('/en/home'); await p.waitFor(`location.pathname==='/en'`, 8000);
  check('signed out: /home goes back to the hub', (await p.url()).endsWith('/en'), await p.url());
  await p.close();
}

// ---- return path: sign-in that started from /recruit lands on /recruit
{
  const p = await b.newPage(await b.newContext());
  await signInWithReturn(p, ids.BUILDER, '/recruit');
  await p.waitFor(`location.pathname==='/en/recruit'`, 8000);
  check('return path: a finished user lands on /recruit after sign-in, not on the hub', (await p.url()).endsWith('/en/recruit'), await p.url());
  check('return path: it is consumed', (await p.eval(`sessionStorage.getItem('ninja.returnTo')`)) === null);
  await p.close();
}

// ---- builder: home -> recruit -> apply -> status
const builderCtx = await b.newContext(); const bp = await b.newPage(builderCtx);
await signIn(bp, ids.BUILDER);
check('finished user lands on the hub (/) after sign-in, not on the dashboard', new URL(await bp.url()).pathname === '/en', await bp.url());
await bp.goto('/en');
await bp.waitText(`Apply to join ${NAME}`, 8000);
check('hub: the hero offers the application while the cohort accepts', (await bp.eval(`[...document.querySelectorAll('main section:first-of-type a')].some(a=>a.innerText.trim()==='Apply to join ${NAME}' && new URL(a.href).pathname==='/en/recruit')`)));
await bp.goto('/en/home');
await bp.waitText('Welcome back, builderone', 8000); await bp.waitText(`${NAME} is recruiting members`, 8000);
const home = await bp.text();
check('home: greeting, activity and the recruitment invitation', home.includes('Welcome back, builderone') && home.includes('Applications') && home.includes(`${NAME} is recruiting members`));
check('home: robots noindex', (await bp.eval(`document.querySelector('meta[name=robots]')?.content || ''`)).includes('noindex'));
clean(await report(bp, 'home (finished, recruiting)'));
await bp.click('Apply now', { selector: 'main a' }); await bp.waitFor(`!!document.querySelector('form')`, 8000);
check('home -> Apply now opens /recruit with the form', (await bp.url()).endsWith('/en/recruit'));
const formText = await bp.text();
check('form: fixed fields, then exactly the configured questions in the configured language', ['Name (real name or nickname)*', 'Telegram ID*', 'X (Twitter) handle*', 'Introduction and motivation*', 'Areas of interest*', 'GitHub URL*', 'KOL (influencer)', 'Community & marketing', 'Business development'].every((t) => formText.includes(t)));
check('form: the removed question and the dropped activity question are gone', !/Web3 experience|Under 1 year|What best describes|Student/.test(formText), formText.slice(0, 300));
const order = await bp.eval(`[...document.querySelectorAll('main form label, main form legend')].map(e=>e.innerText.replace('*','').trim())`);
check('form: introduction comes before the configured questions, which keep their order', order.findIndex((t) => t.startsWith('Introduction')) < order.indexOf('Areas of interest') && order.indexOf('Areas of interest') < order.indexOf('GitHub URL'), order);
check('form shows the recommended length hint', formText.includes('at least 100 characters'));
// invalid first: nothing is sent
bp.reset();
await bp.click('Send application', { exact: true });
check('empty submit sends nothing and marks the fields', !mutations(bp).length && (await bp.eval(`document.querySelectorAll('main [role=alert]').length`)) >= 6);
await fillLabel(bp, 'Name', 'Builder Kim'); await fillLabel(bp, 'Telegram ID', 'https://t.me/builder_it'); await fillLabel(bp, 'X (Twitter) handle', 'builder_it');
await chip(bp, 'Developer', 'Areas of interest'); await chip(bp, 'Researcher', 'Areas of interest'); await chip(bp, 'Other', 'Areas of interest');
await fillLabel(bp, 'Tell us more', 'UX research');
await fillLabel(bp, 'Introduction and motivation', 'I build dashboards for Injective and want to help new builders ship faster.');
// a missing required answer blocks the submit
bp.reset();
await bp.click('Send application', { exact: true });
check('missing required answer (GitHub URL) sends nothing and marks that field', !mutations(bp).length && await bp.eval(`document.querySelector('#cohort-q-${GITHUB_ID}').getAttribute('aria-invalid') === 'true'`), mutations(bp));
await fillLabel(bp, 'GitHub URL', 'https://github.com/builder-it');
bp.reset();
await bp.click('Send application', { exact: true }); await bp.waitText('Your application was sent', 8000); await bp.idle();
const applied = mutations(bp);
clean(await report(bp, 'applied', { applied }));
check('apply: POST /cohorts/:id/applications 201', applied.some((m) => new RegExp(`^POST /cohorts/${cohortId}/applications 201$`).test(m)), applied);
const row = sql(`select status||'|'||telegram||'|'||twitter||'|'||(web3_experience is null and activity_type is null and interest_areas is null)||'|'||(answers->0->>'questionId')||'|'||(select string_agg(c->>'id', ',') from jsonb_array_elements(answers->0->'choices') c)||'|'||coalesce(answers->0->>'other','')||'|'||coalesce(answers->1->>'text','') from cohort_application where cohort_id='${cohortId}' and user_id='${ids.BUILDER}'`);
check('DB: application SUBMITTED with normalized handles, empty legacy columns and the answers snapshot', row === 'SUBMITTED|@builder_it|@builder_it|true|interest_areas|DEVELOPER,RESEARCHER,OTHER|UX research|https://github.com/builder-it', row);
const status1 = await mainText(bp);
check('recruit: shows "Under review" with the answers and Edit/Withdraw', status1.includes('Under review') && status1.includes('Builder Kim') && status1.includes('GitHub URL') && status1.includes('https://github.com/builder-it') && /Edit application/.test(status1) && /Withdraw/.test(status1));

// status on /account and home
await bp.goto('/en/account'); await bp.waitText('Cohort applications', 8000); await bp.waitText(NAME, 8000);
const account = await mainText(bp);
check('/account: lists my cohort application with its status', account.includes(NAME) && account.includes('Under review'));
clean(await report(bp, '/account with cohort application'));
await bp.goto('/en/home'); await bp.waitText('Under review', 8000);
check('home: shows my application status instead of the invitation', !(await bp.text()).includes('Apply now'));
await bp.goto('/en'); await bp.waitText('View my application', 8000);
check('hub: once applied, the hero CTA is View my application -> /recruit (not Apply to join)', (await bp.eval(`[...document.querySelectorAll('main section:first-of-type a')].some(a=>a.innerText.trim()==='View my application' && new URL(a.href).pathname==='/en/recruit')`)) && !(await bp.eval(`[...document.querySelectorAll('main section:first-of-type a')].some(a=>/^Apply to join/.test(a.innerText.trim()))`)));

// edit
await bp.goto('/en/recruit'); await bp.waitText('Edit application', 8000);
await bp.click('Edit application', { exact: true }); await bp.waitFor(`!!document.querySelector('form')`, 5000);
await fillLabel(bp, 'Introduction and motivation', 'Edited: I also run workshops for new Injective builders.');
bp.reset();
await bp.click('Save changes', { exact: true }); await bp.waitText('Your application was updated', 8000);
check('edit: PATCH 200 and the DB intro changed', mutations(bp).some((m) => /^PATCH \/cohorts\/applications\/.+ 200$/.test(m)) && sql(`select intro from cohort_application where user_id='${ids.BUILDER}' and cohort_id='${cohortId}'`).startsWith('Edited:'), mutations(bp));
clean(await report(bp, 'edited'));

// ---- admin reviews it
await adminPage.goto('/en/admin/recruitment'); await adminPage.waitText(NAME, 8000);
await rowButton(adminPage, NAME, 'Applications'); await adminPage.waitText('Builder Kim', 8000);
clean(await report(adminPage, 'admin applications'));
const adminText = await mainText(adminPage);
check('admin: applications table shows the applicant, contacts and status', adminText.includes('Builder Kim') && adminText.includes('@builder_it') && adminText.includes('builder@test.dev') && adminText.includes('Waiting'));
// filters: status that does not match, then the search
await adminPage.eval(`document.querySelector('main [role=combobox][aria-label=Status]').click()`); await adminPage.waitForSelector('[role=option]');
await adminPage.eval(`(()=>{const o=[...document.querySelectorAll('[role=option]')].find(o=>o.innerText.trim()==='Accepted'); o.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true})); o.click()})()`);
await adminPage.click('Apply', { exact: true, selector: 'main form button' }); await adminPage.waitText('No application matches these filters.', 8000);
check('admin: status filter Accepted hides the waiting applicant', (await mainText(adminPage)).includes('No application matches these filters.'));
await adminPage.click('Reset', { exact: true, selector: 'main form button' }); await adminPage.waitText('Builder Kim', 8000);
await fillLabel(adminPage, 'Search', 'builder_it'); await adminPage.click('Apply', { exact: true, selector: 'main form button' }); await adminPage.idle();
check('admin: search by telegram finds the applicant', (await mainText(adminPage)).includes('Builder Kim'));
await adminPage.click('Reset', { exact: true, selector: 'main form button' }); await adminPage.waitText('Builder Kim', 8000);
// question filter: DEVELOPER matches the new-shape row and, through the legacy column, the old one; RESEARCHER only the new one
await select(adminPage, 'Question', 'Areas of interest'); await select(adminPage, 'Option', 'Developer');
adminPage.reset();
await adminPage.click('Apply', { exact: true, selector: 'main form button' }); await adminPage.waitForRequest(/questionId=interest_areas&optionId=DEVELOPER/); await adminPage.idle();
check('admin: question filter sends questionId + optionId and finds both the new and the legacy application', adminPage.requests.some((r) => /questionId=interest_areas&optionId=DEVELOPER/.test(r.url) && r.status === 200) && (await mainText(adminPage)).includes('Builder Kim') && (await mainText(adminPage)).includes('Core Legacy'));
await select(adminPage, 'Option', 'Researcher'); await adminPage.click('Apply', { exact: true, selector: 'main form button' }); await adminPage.idle(); await sleep(500);
check('admin: the Researcher option finds only the new-shape application', (await mainText(adminPage)).includes('Builder Kim') && !(await mainText(adminPage)).includes('Core Legacy'));
await adminPage.click('Reset', { exact: true, selector: 'main form button' }); await adminPage.waitText('Core Legacy', 8000);
// the legacy application is still readable in the review dialog (synthesized answers, including the dropped activity question)
await rowButton(adminPage, 'Core Legacy', 'Review'); await adminPage.waitFor(`!!document.querySelector('dialog[open]')`, 5000);
check('review dialog: a legacy application shows its web3 experience, interests and current activity', await adminPage.eval(`(()=>{const t=document.querySelector('dialog[open]').innerText; return t.includes('Web3 experience') && t.includes('Over 3 years') && t.includes('Current activity') && t.includes('Student') && t.includes('I applied with the old form.')})()`));
await dialogButton(adminPage, 'Cancel');
// review with confirm
await rowButton(adminPage, 'Builder Kim', 'Review'); await adminPage.waitFor(`!!document.querySelector('dialog[open]')`, 5000);
check('review dialog shows the answers and says the note is internal', await adminPage.eval(`(()=>{const t=document.querySelector('dialog[open]').innerText; return t.includes('UX research') && t.includes('GitHub URL') && t.includes('https://github.com/builder-it') && /note is for operators only/i.test(t) && t.includes('Accepting does not make the applicant a member')})()`));
check('review dialog: confirm is disabled until a decision is chosen', await adminPage.eval(`[...document.querySelector('dialog[open]').querySelectorAll('button')].find(b=>b.innerText.trim()==='Choose a decision').disabled`));
await adminPage.eval(`[...document.querySelector('dialog[open]').querySelectorAll('input[type=radio]')].find(i=>i.closest('label').innerText.trim()==='Accept').click()`);
await adminPage.fill('dialog[open] textarea', 'SECRET INTERNAL NOTE strong portfolio');
// Flow 6 may already have made BUILDER a member: the rule is that accepting changes nothing, so compare before and after.
const memberBefore = sql(`select is_member from "user" where id='${ids.BUILDER}'`);
adminPage.reset();
await dialogButton(adminPage, 'Accept application'); await adminPage.waitForMutation(); await adminPage.idle();
check('admin: POST /admin/cohort-applications/:id/review', mutations(adminPage).some((m) => /^POST \/admin\/cohort-applications\/.+\/review 201$/.test(m)), mutations(adminPage));
check('DB: ACCEPTED with the internal note, reviewer set', sql(`select status||'|'||review_note||'|'||(reviewed_by is not null) from cohort_application where user_id='${ids.BUILDER}' and cohort_id='${cohortId}'`) === 'ACCEPTED|SECRET INTERNAL NOTE strong portfolio|true');
check('DB: audit row records the decision change', sql(`select after_data->>'status' from audit_log where action='COHORT_APPLICATION_ACCEPTED' order by created_at desc limit 1`) === 'ACCEPTED');
check('DB: accepting did not change the applicant\'s membership', sql(`select is_member from "user" where id='${ids.BUILDER}'`) === memberBefore, memberBefore);
clean(await report(adminPage, 'admin reviewed'));

// CSV export (UI click + API content check)
adminPage.reset();
await adminPage.click('Export CSV', { exact: true }); await adminPage.waitForRequest(/\/admin\/cohorts\/.+\/applications\.csv/); await adminPage.idle();
check('admin: Export CSV requests the CSV with the session', adminPage.requests.some((r) => /\/admin\/cohorts\/.+\/applications\.csv/.test(r.url) && r.status === 200), adminPage.requests.map((r) => `${r.status} ${r.url}`).filter((u) => /csv/.test(u)));
const csv = await fetch(`${API}/admin/cohorts/${cohortId}/applications.csv`, { headers: { authorization: `Bearer ${adminToken}` } });
const csvBytes = Buffer.from(await csv.arrayBuffer());
const csvText = csvBytes.toString('utf8');
check('CSV: UTF-8 text/csv with BOM, header row and the applicant', (csv.headers.get('content-type') || '').includes('text/csv') && csvText.startsWith('﻿"id"') && csvText.includes('"Builder Kim"') && csvText.includes('builder_it'), csvText.slice(0, 120));
const csvHeader = csvText.split('\r\n')[0];
check('CSV: one column per current question (ko label), then other_answers', csvHeader.includes('"intro","관심 분야","GitHub 주소","other_answers"') && !csvHeader.includes('Web3'), csvHeader);
check('CSV: the legacy application keeps its web3 and current-activity answers in other_answers', csvText.includes('Web3 경력: 3년 이상') && csvText.includes('현재 활동 유형: 학생'), csvText.slice(-600));
check('CSV: the new application has the interest areas incl. the other detail and the GitHub answer', csvText.includes('기타 (UX research)') && csvText.includes('https://github.com/builder-it'), csvText.slice(-600));

// ---- applicant sees the result, never the note
await bp.goto('/en/recruit'); await bp.waitText('Accepted', 8000);
const result = await mainText(bp);
check('applicant: sees Accepted, no Edit/Withdraw, no internal note', result.includes('Accepted') && !/Edit application|Withdraw/.test(result) && !result.includes('SECRET INTERNAL NOTE'));
const mine = await apiAs(tokenFor(ids.BUILDER), 'GET', '/cohorts/applications/me');
check('applicant API response has no review note or reviewer', mine[0] === 200 && !/reviewNote|reviewedBy|SECRET/.test(mine[1]), mine[1].slice(0, 200));
clean(await report(bp, 'applicant sees result'));
await bp.goto('/en/home'); await bp.waitText('Accepted', 8000);
check('home: shows the accepted status', (await mainText(bp)).includes('Accepted'));

// ---- an unfinished sign-up is sent to the step it owes from every page except the hub and /recruit (exempt since QA 2 FE-2: the page itself can open); the API says PROFILE_REQUIRED
{
  const p = await b.newPage(await b.newContext());
  await signIn(p, INCOMPLETE);
  await p.waitFor(`location.pathname.endsWith('/signup/profile')`, 8000);
  await p.goto('/en/recruit'); await new Promise((r) => setTimeout(r, 3000));
  check('unfinished user: /recruit stays open (no forced redirect to the owed onboarding step)', new URL(await p.url()).pathname === '/en/recruit', await p.url());
  const [st, body] = await apiAs(tokenFor(INCOMPLETE), 'POST', `/cohorts/${cohortId}/applications`, { displayName: 'x', telegram: '@abcde', twitter: '@abc', intro: 'hi', answers: [] });
  check('unfinished user: BE answers 409 PROFILE_REQUIRED', st === 409 && body.includes('PROFILE_REQUIRED'), [st, body]);
  clean(await report(p, 'unfinished /recruit'));
  await p.goto('/en'); await p.waitText('Continue sign-up', 8000);
  const heroLinks = await p.eval(`[...document.querySelectorAll('main section:first-of-type a')].map(a=>a.innerText.trim()+' -> '+new URL(a.href).pathname)`);
  check('unfinished user: the hub is open to them (no forced step) and its CTA continues the sign-up', new URL(await p.url()).pathname === '/en' && heroLinks.includes('Continue sign-up -> /en/signup/profile'), [await p.url(), heroLinks]);
  clean(await report(p, 'unfinished hub'));
  await p.close();
}

// ---- an unfinished sign-up that started on /recruit comes back to /recruit after the profile step, without the get-started menu (QA 2 FE-2)
{
  const p = await b.newPage(await b.newContext());
  await signInWithReturn(p, INCOMPLETE2, '/recruit');
  await p.waitFor(`location.pathname.endsWith('/signup/profile')`, 8000);
  await p.waitFor(`!!document.querySelector('#nickname')`);
  await p.fill('#nickname', 'it12return'); await sleep(1300);
  await p.click('Dev'); await p.fill('#bio', 'Came from the recruitment page');
  await p.click('css:form button[type=submit]');
  const back = await p.waitFor(`location.pathname==='/en/recruit'`, 15000);
  const seenMenu = await p.eval(`document.body.innerText.includes('Get started')`);
  check('unfinished sign-up from /recruit: lands back on /recruit after the profile step, not on the get-started menu', back && new URL(await p.url()).pathname === '/en/recruit', await p.url());
  await p.waitFor(`!!document.querySelector('form')`, 10000);
  check('unfinished sign-up from /recruit: the application form is there, no get-started menu', await p.eval(`!!document.querySelector('main form')`) && !seenMenu, { seenMenu });
  clean(await report(p, 'returned to /recruit'));
  await p.close();
}

// ---- the hub is never skipped: a finished user stays on `/`, the logo goes to `/`, About stays reachable, a stale ninja_home cookie is ignored
{
  const p = await b.newPage(builderCtx);
  p.reset();
  await p.goto('/en/bounties');
  await p.eval(`document.cookie = 'ninja_home=1; Path=/'; true`);
  p.reset();
  await p.goto('/en');
  const redirects = await p.eval(`performance.getEntriesByType('navigation')[0].redirectCount`);
  check('finished user: /en is served as the hub (no redirect, even with an old ninja_home cookie)', new URL(await p.url()).pathname === '/en' && redirects === 0, [await p.url(), redirects]);
  const logo = await p.eval(`document.querySelector('header a[aria-label="Ninja Labs home"]').getAttribute('href')`);
  check('finished user: the logo points at the hub', logo === '/en', logo);
  await p.goto('/en/about'); await p.waitFor(`/past activities/i.test(document.body.innerText)`, 8000);
  const about = await p.text();
  check('finished user: /about shows the community sections and stays put', (await p.url()).endsWith('/en/about') && /past activities/i.test(about));
  clean(await report(p, '/about (finished)'));
  await p.goto('/en/signup/get-started');
  await p.close();
}

// ---- withdraw and reapply (admin acts as an applicant), then close the cohort
{
  const p = await b.newPage(adminCtx);
  const [st] = await apiAs(adminToken, 'POST', `/cohorts/${cohortId}/applications`, { displayName: 'Ops Admin', telegram: '@ops_admin', twitter: '@ops_admin', intro: 'ops', answers: [{ questionId: 'interest_areas', choices: ['BIZDEV'] }, { questionId: GITHUB_ID, text: 'https://github.com/ops' }] });
  check('admin as applicant: POST 201', st === 201, st);
  await p.goto('/en/account'); if (!(await p.waitText('Under review', 10000))) throw new Error('account page text: ' + (await mainText(p)).slice(0, 400));
  await p.click('Withdraw', { exact: true, selector: 'main button' }); await p.waitFor(`!!document.querySelector('dialog[open]')`, 5000);
  const sinceWithdraw = p.requests.length;
  await dialogButton(p, 'Withdraw application'); await p.waitForMutation({ since: sinceWithdraw }); await p.idle();
  check('DB: the admin application is WITHDRAWN', sql(`select status from cohort_application where user_id='${ids.ADMIN}' and cohort_id='${cohortId}'`) === 'WITHDRAWN');
  const [st2, body2] = await apiAs(adminToken, 'POST', `/cohorts/${cohortId}/applications`, { displayName: 'Ops Admin', telegram: '@ops_admin', twitter: '@ops_admin', intro: 'ops again', answers: [{ questionId: 'interest_areas', choices: ['BIZDEV'] }, { questionId: GITHUB_ID, text: 'https://github.com/ops' }] });
  check('reapply reopens the same row (same id, SUBMITTED)', st2 === 201 && sql(`select count(*) from cohort_application where user_id='${ids.ADMIN}' and cohort_id='${cohortId}'`) === '1' && sql(`select status from cohort_application where user_id='${ids.ADMIN}' and cohort_id='${cohortId}'`) === 'SUBMITTED', [st2, body2.slice(0, 80)]);
  await p.goto('/en/admin/recruitment'); await p.waitText(NAME, 8000);
  const del = await p.eval(`(()=>{const r=[...document.querySelectorAll('tr')].find(r=>r.innerText.includes(${JSON.stringify(NAME)})); return [...r.querySelectorAll('button')].find(b=>b.innerText.trim()==='Delete').disabled})()`);
  check('admin: a cohort with applications cannot be deleted (button disabled)', del === true);
  const [stDel, bodyDel] = await apiAs(adminToken, 'DELETE', `/admin/cohorts/${cohortId}`);
  check('BE agrees: DELETE is 409 COHORT_HAS_APPLICATIONS', stDel === 409 && bodyDel.includes('COHORT_HAS_APPLICATIONS'), [stDel, bodyDel]);
  await rowButton(p, NAME, 'Close'); const sinceClose = p.requests.length;
  await dialogButton(p, 'Close recruitment'); await p.waitForMutation({ since: sinceClose }); await p.idle();
  check('DB: cohort CLOSED, audit COHORT_CLOSED', sql(`select status from cohort where id='${cohortId}'`) === 'CLOSED' && sql(`select count(*) from audit_log where entity_id='${cohortId}' and action='COHORT_CLOSED'`) === '1');
  clean(await report(p, 'admin closed cohort'));
  await p.close();
}
{
  const p = await b.newPage(builderCtx);
  await p.goto('/en/recruit'); await p.waitText("We're not recruiting right now.", 8000);
  check('after closing: /recruit says we are not recruiting, no form', !(await p.eval(`!!document.querySelector('form')`)));
  const exits = await p.eval(`[...document.querySelectorAll('main a')].map(a=>a.innerText.trim()+' -> '+new URL(a.href).pathname+new URL(a.href).search)`);
  check('after closing: both exits are offered (notices and past activities)', exits.includes('See the notices -> /en/notices') && exits.includes('See past activities -> /en/notices?category=events'), exits);
  await p.goto('/en/about'); await p.waitFor(`/past activities/i.test(document.body.innerText)`, 8000);
  check('after closing: the recruitment banner is gone', !(await p.text()).includes('is recruiting members'));
  clean(await report(p, 'closed /recruit'));
  await p.close();
}
b.close(); done('12 recruitment');
