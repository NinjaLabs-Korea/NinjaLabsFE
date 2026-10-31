// The api-mode "no mock copy" scan of the integration harness (integration/lib/no-mock-copy.mjs).
import { describe, expect, it } from 'vitest';
import * as lib from '../../integration/lib/no-mock-copy.mjs';

const { mockCopyStrings, findMockCopy } = lib as {
  mockCopyStrings: () => string[];
  findMockCopy: (text: string, strings?: string[]) => string[];
};

describe('no-mock-copy', () => {
  const strings = mockCopyStrings();

  it('collects the mock messages of every locale from the catalogs', () => {
    expect(strings).toEqual(expect.arrayContaining(['목업', 'Mock', '세션 미리보기', 'Session preview', '会话预览']));
    expect(strings.some((s) => s.startsWith('Mock mode: starting'))).toBe(true);
  });

  it('flags mock and session-preview copy', () => {
    expect(findMockCopy('Hello 목업 모드', strings)).toContain('목업');
    expect(findMockCopy('This is Session preview text', strings)).toContain('Session preview');
  });

  it('does not flag real copy that merely says preview', () => {
    expect(findMockCopy('멤버 미리보기', strings)).toEqual([]);
    expect(findMockCopy('Preview the sign-in', strings)).toEqual([]);
  });
});
