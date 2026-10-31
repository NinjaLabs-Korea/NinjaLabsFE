// Flow 1: public SSR pages + six 404 variants (status, hydration, forbidden text, DB values rendered).
import { Browser, report, ORIGIN } from '../lib/cdp.mjs'; import { sql, seed, check, clean, done, sleep } from '../lib/harness.mjs';
const b = await Browser.connect(); const ctx = await b.newContext(); const p = await b.newPage(ctx);
const title = (table, id) => sql(`select title from ${table} where id='${id}'`);
const pages = [
  ['/en', 200], ['/ko', 200], ['/zh', 200], ['/en/bounties', 200],
  [`/en/bounties/${seed.B1}`, 200, [title('bounty', seed.B1), '100 INJ']],
  [`/en/bounties/${seed.B2}`, 200, [title('bounty', seed.B2), 'Reward TBD']],
  [`/ko/bounties/${seed.B3}`, 200, [title('bounty', seed.B3)]],
  ['/en/members', 200, ['coreninja']], ['/en/members/coreninja', 200, ['coreninja']],
  ['/en/members/builderone', 200, ['builderone', 'No completed bounties yet']],
  ['/en/notices', 200, [title('notice', seed.N1), title('notice', seed.N2)]],
  [`/en/notices/${seed.N1}`, 200, [title('notice', seed.N1)]], [`/en/notices/${seed.N2}`, 200, [title('notice', seed.N2)]],
  ['/en/hall-of-fame', 200, [sql(`select title from platform_highlight limit 1`)]], ['/zh/hall-of-fame', 200],
  ['/en/does-not-exist', 404], ['/en/bounties/00000000-0000-0000-0000-000000000000', 404], ['/en/notices/00000000-0000-0000-0000-000000000000', 404],
  ['/en/members/nobody_here', 404], ['/en/bounties/not-a-uuid', 404], ['/xx/foo', 404],
];
check('builderone has no parent NFT in DB (NFT copy precondition)', sql(`select count(*) from nft n join "user" u on u.id=n.owner_user_id where u.nickname='builderone'`) === '0');
for (const [path, status, texts = []] of pages) {
  const http = (await fetch(ORIGIN + path, { redirect: 'follow' })).status;
  await p.goto(path); await sleep(600);
  const text = await p.text();
  const r = await report(p, path, { http, snippet: text.replace(/\s+/g, ' ').slice(0, 120) });
  check(`${path}: HTTP ${status}`, http === status, http);
  clean(r, { allowFailed: status === 404 ? [/^404 /] : [], signedOut: true });
  for (const t of texts) check(`${path}: shows "${t}"`, text.includes(t));
}
check('/en/members/builderone: does not claim the NFT is already minted', !(await (async () => { await p.goto('/en/members/builderone'); return (await p.text()).includes('already minted'); })()));
b.close(); done('1 public SSR');
