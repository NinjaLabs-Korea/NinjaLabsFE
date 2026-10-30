// Flow 12: member recruitment end to end. Admin creates and opens a cohort in the UI, a builder applies (home banner ->
// /recruit form), sees the status on the home and /account, edits it, the admin reviews it, the applicant sees the result
// (never the note), the admin closes the cohort. Also: the hub stays open to finished users, return path after sign-in,
// onboarding gate, withdraw/reapply and the CSV export.
import { Browser, report } from '../lib/cdp.mjs';
import { sql, ids, check, clean, done, sleep, signIn, signInWithReturn, apiAs, tokenFor, fillLabel, rowButton, dialogButton, chip, mutations, mainText, API } from '../lib/harness.mjs';

const b = await Browser.connect();
const NAME = 'IT Spring Cohort';
const adminToken = tokenFor(ids.ADMIN, true);
// Flow 2 completes the seeded step-3 user, so this flow makes its own unfinished sign-up (profile step still owed).
const INCOMPLETE = sql(`INSERT INTO "user"(google_id,email,nickname,bio,onboarding_step) VALUES ('g-inc-12','inc12@test.dev','user_inc120001','',3) RETURNING id`).split(String.fromCharCode(10))[0];
const clickSave = async (page) => { await page.eval(`[...document.querySelectorAll('main button')].filter(b=>b.innerText.trim()==='Save').pop().click()`); await sleep(1800); await page.idle(); };

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
await dialogButton(adminPage, 'Open recruitment'); await sleep(800); await adminPage.idle();
check('DB: cohort is OPEN after the confirmed transition', sql(`select status from cohort where id='${cohortId}'`) === 'OPEN');
check('DB: audit rows for create and open', sql(`select string_agg(action, ',' order by created_at) from audit_log where entity_id='${cohortId}'`) === 'COHORT_CREATED,COHORT_OPENED');

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
check('home: greeting, activity and the recruitment invitation', home.includes('Welcome back, builderone') && home.includes('Applications and submissions') && home.includes(`${NAME} is recruiting members`));
check('home: robots noindex', (await bp.eval(`document.querySelector('meta[name=robots]')?.content || ''`)).includes('noindex'));
clean(await report(bp, 'home (finished, recruiting)'));
await bp.click('Apply now', { selector: 'main a' }); await bp.waitFor(`!!document.querySelector('form')`, 8000);
check('home -> Apply now opens /recruit with the form', (await bp.url()).endsWith('/en/recruit'));
const formText = await bp.text();
check('form has the Tally questions and options', ['Name (real name or nickname)*', 'Telegram ID*', 'Twitter (X) ID*', 'Web3 experience*', 'Under 1 year', '1-3 years', 'Over 3 years', 'KOL (influencer)', 'Community & marketing', 'Business development', 'Student', 'Introduction and motivation*'].every((t) => formText.includes(t)));
check('form shows the recommended length hint', formText.includes('100-300 characters recommended'));
// invalid first: nothing is sent
bp.reset();
await bp.click('Send application', { exact: true });
check('empty submit sends nothing and marks the fields', !mutations(bp).length && (await bp.eval(`document.querySelectorAll('main [role=alert]').length`)) >= 6);
await fillLabel(bp, 'Name', 'Builder Kim'); await fillLabel(bp, 'Telegram ID', 'https://t.me/builder_it'); await fillLabel(bp, 'Twitter (X) ID', 'builder_it');
await chip(bp, '1-3 years'); await chip(bp, 'Developer', 'What best describes'); await chip(bp, 'Developer', 'Areas you want'); await chip(bp, 'Researcher', 'Areas you want'); await chip(bp, 'Other', 'Areas you want');
await fillLabel(bp, 'Tell us which area', 'UX research');
await fillLabel(bp, 'Introduction and motivation', 'I build dashboards for Injective and want to help new builders ship faster.');
bp.reset();
await bp.click('Send application', { exact: true }); await bp.waitText('Your application was sent', 8000); await bp.idle();
const applied = mutations(bp);
clean(await report(bp, 'applied', { applied }));
check('apply: POST /cohorts/:id/applications 201', applied.some((m) => new RegExp(`^POST /cohorts/${cohortId}/applications 201$`).test(m)), applied);
const row = sql(`select status||'|'||telegram||'|'||twitter||'|'||activity_type||'|'||array_to_string(interest_areas,',')||'|'||coalesce(interest_other,'') from cohort_application where cohort_id='${cohortId}' and user_id='${ids.BUILDER}'`);
check('DB: application SUBMITTED with normalized handles and the other-detail', row === 'SUBMITTED|@builder_it|@builder_it|DEVELOPER|DEVELOPER,RESEARCHER,OTHER|UX research', row);
const status1 = await mainText(bp);
check('recruit: shows "Under review" with the answers and Edit/Withdraw', status1.includes('Under review') && status1.includes('Builder Kim') && /Edit application/.test(status1) && /Withdraw/.test(status1));

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
await adminPage.eval(`document.querySelector('main [role=combobox][aria-label=Status]').click()`); await sleep(200);
await adminPage.eval(`(()=>{const o=[...document.querySelectorAll('[role=option]')].find(o=>o.innerText.trim()==='Accepted'); o.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true})); o.click()})()`);
await adminPage.click('Apply', { exact: true, selector: 'main form button' }); await sleep(800);
check('admin: status filter Accepted hides the waiting applicant', (await mainText(adminPage)).includes('No application matches these filters.'));
await adminPage.click('Reset', { exact: true, selector: 'main form button' }); await adminPage.waitText('Builder Kim', 8000);
await fillLabel(adminPage, 'Search', 'builder_it'); await adminPage.click('Apply', { exact: true, selector: 'main form button' }); await sleep(800);
check('admin: search by telegram finds the applicant', (await mainText(adminPage)).includes('Builder Kim'));
// review with confirm
await rowButton(adminPage, 'Builder Kim', 'Review'); await adminPage.waitFor(`!!document.querySelector('dialog[open]')`, 5000);
check('review dialog shows the answers and says the note is internal', await adminPage.eval(`(()=>{const t=document.querySelector('dialog[open]').innerText; return t.includes('UX research') && /note is for operators only/i.test(t) && t.includes('Accepting does not make the applicant a member')})()`));
check('review dialog: confirm is disabled until a decision is chosen', await adminPage.eval(`[...document.querySelector('dialog[open]').querySelectorAll('button')].find(b=>b.innerText.trim()==='Choose a decision').disabled`));
await adminPage.eval(`[...document.querySelector('dialog[open]').querySelectorAll('input[type=radio]')].find(i=>i.closest('label').innerText.trim()==='Accept').click()`);
await adminPage.fill('dialog[open] textarea', 'SECRET INTERNAL NOTE strong portfolio');
// Flow 6 may already have made BUILDER a member: the rule is that accepting changes nothing, so compare before and after.
const memberBefore = sql(`select is_member from "user" where id='${ids.BUILDER}'`);
adminPage.reset();
await dialogButton(adminPage, 'Accept application'); await sleep(1000); await adminPage.idle();
check('admin: POST /admin/cohort-applications/:id/review', mutations(adminPage).some((m) => /^POST \/admin\/cohort-applications\/.+\/review 201$/.test(m)), mutations(adminPage));
check('DB: ACCEPTED with the internal note, reviewer set', sql(`select status||'|'||review_note||'|'||(reviewed_by is not null) from cohort_application where user_id='${ids.BUILDER}' and cohort_id='${cohortId}'`) === 'ACCEPTED|SECRET INTERNAL NOTE strong portfolio|true');
check('DB: audit row records the decision change', sql(`select after_data->>'status' from audit_log where action='COHORT_APPLICATION_ACCEPTED' order by created_at desc limit 1`) === 'ACCEPTED');
check('DB: accepting did not change the applicant\'s membership', sql(`select is_member from "user" where id='${ids.BUILDER}'`) === memberBefore, memberBefore);
clean(await report(adminPage, 'admin reviewed'));

// CSV export (UI click + API content check)
adminPage.reset();
await adminPage.click('Export CSV', { exact: true }); await sleep(1200); await adminPage.idle();
check('admin: Export CSV requests the CSV with the session', adminPage.requests.some((r) => /\/admin\/cohorts\/.+\/applications\.csv/.test(r.url) && r.status === 200), adminPage.requests.map((r) => `${r.status} ${r.url}`).filter((u) => /csv/.test(u)));
const csv = await fetch(`${API}/admin/cohorts/${cohortId}/applications.csv`, { headers: { authorization: `Bearer ${adminToken}` } });
const csvBytes = Buffer.from(await csv.arrayBuffer());
const csvText = csvBytes.toString('utf8');
check('CSV: UTF-8 text/csv with BOM, header row and the applicant', (csv.headers.get('content-type') || '').includes('text/csv') && csvText.startsWith('﻿"id"') && csvText.includes('"Builder Kim"') && csvText.includes('builder_it'), csvText.slice(0, 120));

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
  const [st, body] = await apiAs(tokenFor(INCOMPLETE), 'POST', `/cohorts/${cohortId}/applications`, { displayName: 'x', telegram: '@abcde', twitter: '@abc', web3Experience: 'LT_1Y', activityType: 'STUDENT', interestAreas: ['DEVELOPER'], intro: 'hi' });
  check('unfinished user: BE answers 409 PROFILE_REQUIRED', st === 409 && body.includes('PROFILE_REQUIRED'), [st, body]);
  clean(await report(p, 'unfinished /recruit'));
  await p.goto('/en'); await p.waitText('Continue sign-up', 8000);
  const heroLinks = await p.eval(`[...document.querySelectorAll('main section:first-of-type a')].map(a=>a.innerText.trim()+' -> '+new URL(a.href).pathname)`);
  check('unfinished user: the hub is open to them (no forced step) and its CTA continues the sign-up', new URL(await p.url()).pathname === '/en' && heroLinks.includes('Continue sign-up -> /en/signup/profile'), [await p.url(), heroLinks]);
  clean(await report(p, 'unfinished hub'));
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
  await p.goto('/en/about'); await sleep(500);
  const about = await p.text();
  check('finished user: /about shows the community sections and stays put', (await p.url()).endsWith('/en/about') && /past activities/i.test(about));
  clean(await report(p, '/about (finished)'));
  await p.goto('/en/signup/get-started');
  await p.close();
}

// ---- withdraw and reapply (admin acts as an applicant), then close the cohort
{
  const p = await b.newPage(adminCtx);
  const [st] = await apiAs(adminToken, 'POST', `/cohorts/${cohortId}/applications`, { displayName: 'Ops Admin', telegram: '@ops_admin', twitter: '@ops_admin', web3Experience: 'GT_3Y', activityType: 'BIZDEV', interestAreas: ['BIZDEV'], intro: 'ops' });
  check('admin as applicant: POST 201', st === 201, st);
  await p.goto('/en/account'); if (!(await p.waitText('Under review', 10000))) throw new Error('account page text: ' + (await mainText(p)).slice(0, 400));
  await p.click('Withdraw', { exact: true, selector: 'main button' }); await p.waitFor(`!!document.querySelector('dialog[open]')`, 5000);
  await dialogButton(p, 'Withdraw application'); await sleep(1000); await p.idle();
  check('DB: the admin application is WITHDRAWN', sql(`select status from cohort_application where user_id='${ids.ADMIN}' and cohort_id='${cohortId}'`) === 'WITHDRAWN');
  const [st2, body2] = await apiAs(adminToken, 'POST', `/cohorts/${cohortId}/applications`, { displayName: 'Ops Admin', telegram: '@ops_admin', twitter: '@ops_admin', web3Experience: 'GT_3Y', activityType: 'BIZDEV', interestAreas: ['BIZDEV'], intro: 'ops again' });
  check('reapply reopens the same row (same id, SUBMITTED)', st2 === 201 && sql(`select count(*) from cohort_application where user_id='${ids.ADMIN}' and cohort_id='${cohortId}'`) === '1' && sql(`select status from cohort_application where user_id='${ids.ADMIN}' and cohort_id='${cohortId}'`) === 'SUBMITTED', [st2, body2.slice(0, 80)]);
  await p.goto('/en/admin/recruitment'); await p.waitText(NAME, 8000);
  const del = await p.eval(`(()=>{const r=[...document.querySelectorAll('tr')].find(r=>r.innerText.includes(${JSON.stringify(NAME)})); return [...r.querySelectorAll('button')].find(b=>b.innerText.trim()==='Delete').disabled})()`);
  check('admin: a cohort with applications cannot be deleted (button disabled)', del === true);
  const [stDel, bodyDel] = await apiAs(adminToken, 'DELETE', `/admin/cohorts/${cohortId}`);
  check('BE agrees: DELETE is 409 COHORT_HAS_APPLICATIONS', stDel === 409 && bodyDel.includes('COHORT_HAS_APPLICATIONS'), [stDel, bodyDel]);
  await rowButton(p, NAME, 'Close'); await dialogButton(p, 'Close recruitment'); await sleep(900); await p.idle();
  check('DB: cohort CLOSED, audit COHORT_CLOSED', sql(`select status from cohort where id='${cohortId}'`) === 'CLOSED' && sql(`select count(*) from audit_log where entity_id='${cohortId}' and action='COHORT_CLOSED'`) === '1');
  clean(await report(p, 'admin closed cohort'));
  await p.close();
}
{
  const p = await b.newPage(builderCtx);
  await p.goto('/en/recruit'); await p.waitText('No cohort is recruiting right now', 8000);
  check('after closing: /recruit says no cohort is recruiting, no form', !(await p.eval(`!!document.querySelector('form')`)));
  await p.goto('/en/about'); await sleep(800);
  check('after closing: the recruitment banner is gone', !(await p.text()).includes('is recruiting members'));
  clean(await report(p, 'closed /recruit'));
  await p.close();
}
b.close(); done('12 recruitment');
