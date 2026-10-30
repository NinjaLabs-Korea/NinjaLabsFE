// api mode must never show mock-mode / session-preview copy. The strings come from the message catalogs themselves (every
// key under a "mock*" name plus common.userMenu.sessionPreview), so renaming a message cannot silently weaken the check.
// A bare '미리보기' / 'preview' is NOT searched: real copy (e.g. 멤버 미리보기) uses those words.
import fs from 'node:fs';
import path from 'node:path';

const MESSAGES_DIR = path.resolve(import.meta.dirname, '../../messages');
const FIXED = ['목업', 'Mock', 'mock mode', '로컬 세션 미리보기', '세션 미리보기'];
const isMockKey = (k) => /mock/i.test(k) || k === 'sessionPreview';

function* walk(node, inMock = false) {
  if (typeof node === 'string') { if (inMock) yield node; return; }
  if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) yield* walk(v, inMock || isMockKey(k));
}

/** Fixed phrases + every mock-mode message string of every locale (ICU placeholders make a string unsearchable: skipped). */
function buildMockCopyStrings(dir) {
  const out = new Set(FIXED);
  for (const locale of fs.readdirSync(dir)) {
    const ld = path.join(dir, locale);
    if (!fs.statSync(ld).isDirectory()) continue;
    for (const f of fs.readdirSync(ld).filter((x) => x.endsWith('.json'))) {
      for (const s of walk(JSON.parse(fs.readFileSync(path.join(ld, f), 'utf8')))) if (!/[{}]/.test(s)) out.add(s.trim());
    }
  }
  return [...out].filter(Boolean);
}

let cachedDefault; // flow14 calls findMockCopy per route and locale: scan the catalogs once
export const mockCopyStrings = (dir = MESSAGES_DIR) =>
  dir === MESSAGES_DIR ? (cachedDefault ??= buildMockCopyStrings(dir)) : buildMockCopyStrings(dir);

export function findMockCopy(text, strings = mockCopyStrings()) {
  return strings.filter((s) => text.includes(s));
}
