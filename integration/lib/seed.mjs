// Seeds a freshly migrated database: users by SQL (no Google login exists here), content through the BE admin API so it
// passes the same validation the admin console uses. Returns { ids, seed } for state.json.
import { signAccess } from './jwt.mjs';

/**
 * @param {{ sql: (q: string) => string, apiOrigin: string, feOrigin: string, jwtSecret: string }} env
 */
export async function seedDatabase({ sql, apiOrigin, feOrigin, jwtSecret }) {
  const one = (q) => sql(q).split('\n')[0];
  const user = (cols, vals) => one(`INSERT INTO "user"(${cols}) VALUES (${vals}) RETURNING id`);
  const ADMIN = user('google_id,email,nickname,bio,onboarding_step,onboarding_completed_at,is_admin', `'g-admin','admin@test.dev','adminninja','Ops admin',4,now(),true`);
  const BUILDER = user('google_id,email,nickname,bio,onboarding_step,onboarding_completed_at', `'g-b','builder@test.dev','builderone','I build things',4,now()`);
  const NEWBIE = user('google_id,email,nickname,bio,onboarding_step', `'g-n','newbie@test.dev','user_ab12cd34','',3`);
  const N2 = user('google_id,email,nickname,bio,onboarding_step', `'g-n2','n2@test.dev','user_ffee0011','',2`);
  user('google_id,email,nickname,bio,onboarding_step,onboarding_completed_at,is_member,member_role,member_display_order', `'g-m','member@test.dev','coreninja','Core team member',4,now(),true,'CORE',1`);

  const token = signAccess(jwtSecret, ADMIN, true, 3600);
  const admin = async (method, path, body) => {
    const r = await fetch(apiOrigin + path, {
      method,
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', origin: feOrigin },
      body: body && JSON.stringify(body),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`seed ${method} ${path}: ${r.status} ${text}`);
    return text ? JSON.parse(text) : null;
  };
  const days = (n) => new Date(Date.now() + n * 864e5).toISOString();

  const B1 = (await admin('POST', '/admin/bounties', {
    title: 'Build an Injective dashboard', sponsorName: 'NinjaLabs', summary: 'Dashboard for INJ stats', description: '## Goal\nBuild it.',
    requirements: '- React', evaluationCriteria: '- Quality', category: 'DEV', applicationRequired: true, submissionMode: 'DIRECT', maxWinners: 1,
    submissionDeadline: days(14),
    reward: { tokenType: 'NATIVE', tokenDenom: 'inj', displaySymbol: 'INJ', amount: '100000000000000000000' },
  })).id;
  const rewardId = one(`select id from bounty_reward where bounty_id='${B1}'`);
  await admin('POST', `/admin/rewards/${rewardId}/confirm-deposit`, { txHash: 'AB'.repeat(32), depositedAmount: '100000000000000000000' });
  const plain = async (title, category) => (await admin('POST', '/admin/bounties', {
    title, sponsorName: 'Injective', summary: `${title} summary`, description: `Desc of ${title}`, requirements: '- req', evaluationCriteria: '- crit',
    category, applicationRequired: false, submissionMode: 'DIRECT', maxWinners: 2, submissionDeadline: days(10),
  })).id;
  const B2 = await plain('Write an Injective tutorial', 'CONTENT');
  const B3 = await plain('Design a mascot', 'DESIGN');
  for (const b of [B1, B2, B3]) await admin('POST', `/admin/bounties/${b}/transition`, { to: 'OPEN' });
  // A past-deadline OPEN bounty cannot be created through the API (deadline must be in the future).
  sql(`update bounty set submission_deadline=now()-interval '2 days' where id='${B3}'`);

  const N1 = (await admin('POST', '/admin/notices', { title: 'Welcome to NinjaLabs', summary: 'Kickoff', body: '# Hello\nWelcome builders.', category: 'NINJALABS', publish: true })).id;
  const N2N = (await admin('POST', '/admin/notices', { title: 'Injective hackathon', summary: 'Event soon', body: 'Join the **hackathon**.', category: 'EVENT', externalUrl: 'https://injective.com', publish: true })).id;
  await admin('POST', '/admin/highlights', { type: 'PROJECT', title: 'Helix clone', description: 'Great build', linkUrl: 'https://example.com', publish: true });

  return { ids: { ADMIN, BUILDER, NEWBIE, N2 }, seed: { B1, B2, B3, N1, N2: N2N } };
}
