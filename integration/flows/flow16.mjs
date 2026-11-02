// Flow 16: profile photo. A member uploads a photo on /account (real file input via CDP), it shows in the header chip,
// on /home, on the public profile and on the (cached, then expired) /members list, the chip hint keeps it for a reload,
// and removing it deletes the old /media row and brings the initials back everywhere.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import zlib from 'node:zlib';
import { Browser, report } from '../lib/cdp.mjs'; import { sql, check, clean, done, signIn, sleep, API } from '../lib/harness.mjs';

/** A real 48x48 RGB PNG (the BE checks the magic bytes, the optimizer decodes it). */
function png(size = 48) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([len, body, sum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  const rows = Buffer.concat(Array.from({ length: size }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0x7a)])));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

const MEMBER = sql(`select id from "user" where nickname='coreninja'`);
const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ninja-it-avatar-')), 'me.png');
fs.writeFileSync(file, png());
// The visible avatar in `scope` (the header also keeps the closed mobile menu's copy in the DOM, and a hidden lazy image never loads).
const avatarState = (scope) => `(() => { const all = [...document.querySelectorAll(${JSON.stringify(scope)} + ' [data-avatar]')]; const el = all.find((e) => e.getClientRects().length > 0) ?? all[0]; if (!el) return 'none'; const img = el.querySelector('img'); return el.dataset.avatar + (img ? (img.complete && img.naturalWidth > 0 ? ':loaded' : ':pending') : ''); })()`;

const b = await Browser.connect(); const ctx = await b.newContext(); const p = await b.newPage(ctx);
check('precondition: the seeded member has no photo', sql(`select avatar_media_id is null from "user" where id='${MEMBER}'`) === 't');

// Warm the cached public member list with the initials first, so the photo showing there later proves the expiry.
await p.goto('/en/members'); await p.waitText('coreninja', 8000);
check('/members before: the member card shows initials', (await p.eval(avatarState('main'))) === 'initials');

await signIn(p, MEMBER);
await p.goto('/en/account'); await p.waitFor(`!!document.querySelector('[data-testid=avatar-settings] input[type=file]')`, 10000);
const { root } = await p.send('DOM.getDocument', { depth: 0 });
const { nodeId } = await p.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-testid=avatar-settings] input[type=file]' });
await p.send('DOM.setFileInputFiles', { nodeId, files: [file] });
await p.waitText('This is a preview. Save to use it.', 5000);
check('picking a file shows a blob preview', await p.eval(`document.querySelector('[data-testid=avatar-settings] img')?.src.startsWith('blob:') ?? false`));
p.reset();
await p.click('Save photo', { exact: true });
await p.waitForRequest(/\/users\/me\/avatar$/, { timeout: 10000 });
await p.waitText('Profile photo saved.', 10000); await p.idle();
const upload = p.requests.filter((r) => r.url === API + '/users/me/avatar' && r.method === 'POST').map((r) => r.status);
const mediaId = sql(`select avatar_media_id from "user" where id='${MEMBER}'`);
clean(await report(p, '/account after upload', { upload, mediaId }));
check('POST /users/me/avatar 201', JSON.stringify(upload) === '[201]', upload);
check('DB: avatar_media_id set and its media row exists', mediaId !== '' && sql(`select count(*) from media_asset where id='${mediaId}'`) === '1', mediaId);
// The header copy can sit in a hidden (closed menu / narrow viewport) box where a lazy image never loads, so check what is
// rendered and where it points rather than the pixels; the pixels are checked on /home and the public profile below.
const headerPhotoSrc = `document.querySelector('header [data-avatar=photo] img')?.getAttribute('src') ?? ''`;
await p.waitFor(`${avatarState('header')}.startsWith('photo')`, 8000);
const headerSrc = await p.eval(headerPhotoSrc);
check('header chip shows the photo after the re-read', (await p.eval(avatarState('header'))).startsWith('photo') && headerSrc.includes(encodeURIComponent(`/media/${mediaId}`)), { state: await p.eval(avatarState('header')), headerSrc });
check('chip hint stores only the /media path', (await p.eval(`JSON.parse(localStorage.getItem('ninja.session.chip')||'{}').avatarUrl`)) === `/media/${mediaId}`);

await p.goto('/en/account'); await p.waitFor(`${avatarState('header')}.startsWith('photo')`, 8000);
check('reload: header chip paints the photo', (await p.eval(avatarState('header'))).startsWith('photo') && (await p.eval(headerPhotoSrc)).includes(encodeURIComponent(`/media/${mediaId}`)));

await p.goto('/en/home'); await p.waitFor(`${avatarState('main')}.endsWith(':loaded')`, 10000);
clean(await report(p, '/home with photo'));
check('/home greeting card shows the photo', (await p.eval(avatarState('main'))) === 'photo:loaded');

await p.goto('/en/members/coreninja'); await p.waitFor(`${avatarState('main')}.endsWith(':loaded')`, 10000);
const optimized = await p.eval(`document.querySelector('main [data-avatar] img')?.getAttribute('src') ?? ''`);
clean(await report(p, 'public profile with photo', { optimized }));
check('public profile hero shows the photo through the image optimizer', (await p.eval(avatarState('main'))) === 'photo:loaded' && optimized.includes('/_next/image') && optimized.includes(encodeURIComponent(`/media/${mediaId}`)), optimized);

await p.goto('/en/members'); await p.waitFor(`${avatarState('main')}.endsWith(':loaded')`, 10000);
check('/members after: the cached list was expired and shows the photo', (await p.eval(avatarState('main'))) === 'photo:loaded');

await p.goto('/en/account'); await p.waitText('Remove photo', 10000);
p.reset();
await p.click('Remove photo', { exact: true });
await p.waitText('Profile photo removed.', 10000); await p.idle(); await sleep(300);
const removal = p.requests.filter((r) => r.url === API + '/users/me/avatar' && r.method === 'DELETE').map((r) => r.status);
clean(await report(p, '/account after removal', { removal }));
check('DELETE /users/me/avatar 200', JSON.stringify(removal) === '[200]', removal);
check('DB: photo cleared and the old media row deleted', sql(`select avatar_media_id is null from "user" where id='${MEMBER}'`) === 't' && sql(`select count(*) from media_asset where id='${mediaId}'`) === '0');
check('old /media URL answers 404', (await fetch(`${API}/media/${mediaId}`)).status === 404);
await p.waitFor(`${avatarState('header')} === 'initials'`, 8000);
check('header chip is back to initials', (await p.eval(avatarState('header'))) === 'initials');
check('chip hint dropped the photo', (await p.eval(`JSON.parse(localStorage.getItem('ninja.session.chip')||'{}').avatarUrl ?? null`)) === null);
await p.goto('/en/members'); await p.waitText('coreninja', 8000);
check('/members: initials again', (await p.eval(avatarState('main'))) === 'initials');

fs.rmSync(path.dirname(file), { recursive: true, force: true });
b.close(); done('16 profile photo');
