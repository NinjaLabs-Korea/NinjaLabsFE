// Flow 10: payout policy + re-apply.
// A) payout policy through the BE API with two admins: DELETE of a funded bounty -> 409 BOUNTY_HAS_OPEN_FUNDS; admin 1
//    requests a payout and cannot approve it (403 PAYOUT_SELF_APPROVAL); admin 2 approves (APPROVED, approved_by) ; DELETE
//    still 409 while the payout is open. DB rows asserted.
// B) re-apply: builder applies from the FE bounty page, withdraws (API - the FE has no withdraw control), re-applies from the
//    FE bounty page -> the same application row is PENDING again and /applications lists it.
import { Browser, report } from '../lib/cdp.mjs'; 
import { sql, ids, seed, check, clean, done, sleep, signIn, apiAs, mutations, tokenFor } from '../lib/harness.mjs';
const A1 = tokenFor(ids.ADMIN, true);
let ADMIN2 = sql(`select id from "user" where google_id='g-admin2'`);
if (!ADMIN2) ADMIN2 = sql(`INSERT INTO "user"(google_id,email,nickname,bio,onboarding_step,onboarding_completed_at,is_admin) VALUES ('g-admin2','admin2@test.dev','secondadmin','Second admin',4,now(),true) RETURNING id`).split('\n')[0];
const A2 = tokenFor(ADMIN2, true); const BT = tokenFor(ids.BUILDER, false);
const body = (t) => { try { return JSON.parse(t); } catch { return t; } };
{ // A
  const RW = sql(`select id from bounty_reward where bounty_id='${seed.B1}'`);
  const [d1, d1b] = await apiAs(A1, 'DELETE', `/admin/bounties/${seed.B1}`);
  check('A: DELETE funded bounty -> 409 BOUNTY_HAS_OPEN_FUNDS', d1 === 409 && body(d1b).message === 'BOUNTY_HAS_OPEN_FUNDS', [d1, d1b]);
  check('DB: bounty not deleted', sql(`select (deleted_at is null)::text from bounty where id='${seed.B1}'`) === 'true');
  // winner needs a primary wallet and an APPROVED submission
  if (sql(`select count(*) from wallet where user_id='${ids.BUILDER}' and disconnected_at is null`) === '0')
    sql(`insert into wallet (user_id, chain, address, is_primary, verified_at) values ('${ids.BUILDER}','INJECTIVE','inj1builderwallet000000000000000000000000000',true,now())`);
  const SUB = sql(`select id from bounty_submission where bounty_id='${seed.B1}' and submitter_user_id='${ids.BUILDER}'`);
  let [rv, rvb] = await apiAs(A1, 'POST', `/admin/submissions/${SUB}/review`, { decision: 'APPROVE' });
  if (rv >= 400) { await apiAs(A1, 'POST', `/admin/submissions/${SUB}/review`, { decision: 'START_REVIEW' }); [rv, rvb] = await apiAs(A1, 'POST', `/admin/submissions/${SUB}/review`, { decision: 'APPROVE' }); }
  check('A: submission approved', rv < 300 && sql(`select status from bounty_submission where id='${SUB}'`) === 'APPROVED', [rv, rvb]);
  const [rq, rqb] = await apiAs(A1, 'POST', '/admin/payouts', { rewardId: RW, submissionId: SUB, amount: '100000000000000000000' });
  const PO = body(rqb).id;
  check('A: admin 1 requests the payout -> 201', rq === 201 && !!PO, [rq, rqb]);
  const [s1, s1b] = await apiAs(A1, 'POST', `/admin/payouts/${PO}/approve`);
  check('A: admin 1 approving own request -> 403 PAYOUT_SELF_APPROVAL', s1 === 403 && body(s1b).message === 'PAYOUT_SELF_APPROVAL', [s1, s1b]);
  check('DB: payout still REQUESTED, approved_by null', sql(`select status||' '||coalesce(approved_by::text,'null') from payout where id='${PO}'`) === 'REQUESTED null');
  const [s2, s2b] = await apiAs(A2, 'POST', `/admin/payouts/${PO}/approve`);
  check('A: admin 2 approves -> 2xx', s2 >= 200 && s2 < 300, [s2, s2b]);
  check('DB: payout APPROVED, requested_by admin 1, approved_by admin 2', sql(`select status||' '||requested_by||' '||approved_by from payout where id='${PO}'`) === `APPROVED ${ids.ADMIN} ${ADMIN2}`);
  const [d2, d2b] = await apiAs(A2, 'DELETE', `/admin/bounties/${seed.B1}`);
  check('A: DELETE with an approved-but-unpaid payout -> 409 BOUNTY_HAS_OPEN_FUNDS', d2 === 409 && body(d2b).message === 'BOUNTY_HAS_OPEN_FUNDS', [d2, d2b]);
  check('DB: audit has PAYOUT_REQUESTED by admin 1 and an approval by admin 2', sql(`select count(*) from audit_log where entity_id='${PO}' and ((actor_user_id='${ids.ADMIN}' and action='PAYOUT_REQUESTED') or (actor_user_id='${ADMIN2}' and action like 'PAYOUT_APPROVED%'))`) === '2', sql(`select string_agg(action||':'||actor_user_id, ', ') from audit_log where entity_id='${PO}'`));
}
{ // B
  const D = new Date(Date.now() + 12 * 864e5).toISOString();
  const [cs, cb] = await apiAs(A1, 'POST', '/admin/bounties', { title: 'Reapply bounty', sponsorName: 'NinjaLabs', summary: 'Reapply summary', description: 'Reapply desc', requirements: '- r', evaluationCriteria: '- c', category: 'DEV', applicationRequired: true, submissionMode: 'DIRECT', maxWinners: 1, submissionDeadline: D });
  const B4 = body(cb).id; await apiAs(A1, 'POST', `/admin/bounties/${B4}/transition`, { to: 'OPEN' });
  check('B: application bounty created + OPEN', cs === 201 && sql(`select status from bounty where id='${B4}'`) === 'OPEN', [cs, cb]);
  const b = await Browser.connect(); const ctx = await b.newContext(); const p = await b.newPage(ctx);
  await signIn(p, ids.BUILDER);
  const apply = async (label, url) => {
    await p.goto(`/en/bounties/${B4}`);
    const formOk = await p.waitFor(`!!document.querySelector('form input[name=portfolioUrl]')`, 8000);
    check(`B: ${label}: apply form shown on the bounty page`, formOk, (await p.text()).replace(/\s+/g, ' ').slice(0, 300));
    await p.fill('form input[name=portfolioUrl]', url);
    await p.eval(`(()=>{const f=document.querySelector('form'); for (const el of f.querySelectorAll('textarea')) { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el, 'I want to build this, ${label}.'); el.dispatchEvent(new Event('input',{bubbles:true})); } return true})()`);
    p.reset(); await p.click('css:form button[type=submit]'); await sleep(2000); await p.idle();
    const m = mutations(p); clean(await report(p, `B: ${label}`, { m }));
    check(`B: ${label}: POST /bounties/:id/applications 201`, m.some((x) => /^POST \/bounties\/.+\/applications 201$/.test(x)), m);
  };
  await apply('first apply', 'https://github.com/builderone/first');
  const first = sql(`select id||' '||status from bounty_application where bounty_id='${B4}' and applicant_user_id='${ids.BUILDER}'`);
  check('DB: first application PENDING', first.endsWith(' PENDING'), first);
  const APP = first.split(' ')[0];
  const [ws, wb] = await apiAs(BT, 'POST', `/applications/${APP}/withdraw`);
  check('B: withdraw -> 2xx, DB WITHDRAWN', ws < 300 && sql(`select status from bounty_application where id='${APP}'`) === 'WITHDRAWN', [ws, wb]);
  await p.goto('/en/applications'); await sleep(800);
  check('B: /applications hides the withdrawn application', !(await p.text()).includes('Reapply bounty'));
  await apply('re-apply', 'https://github.com/builderone/second');
  const again = sql(`select count(*)||' '||max(id::text)||' '||max(status)||' '||max(portfolio_url) from bounty_application where bounty_id='${B4}' and applicant_user_id='${ids.BUILDER}'`);
  check('DB: re-apply reopened the same row -> PENDING with the new portfolio URL', again === `1 ${APP} PENDING https://github.com/builderone/second`, again);
  await p.goto('/en/applications'); await p.waitText('Reapply bounty', 8000);
  const apps = await p.text(); clean(await report(p, 'B: /applications after re-apply'));
  const row = apps.replace(/\s+/g, ' '); const at = row.indexOf('Reapply bounty');
  check('B: /applications shows the re-applied bounty with status Applied and the new message', at >= 0 && /Applied Applied \w+ \d+, \d{4} Reapply bounty I want to build this, re-apply\./.test(row), row.slice(0, 400));
  await b.disposeContext(ctx); b.close();
}
done('10 payout policy + re-apply');
