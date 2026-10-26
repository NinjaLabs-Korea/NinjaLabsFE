/**
 * 제출자에게 보이는 심사 코멘트(BE `GET /submissions/me`의 `review_comment` = 최신 `submission_review.comment`) 해석.
 * 운영자가 `scripts/forfeit-award.js`로 수상을 몰수하면 코멘트가 `forfeited: <reason>`으로 기록된다 - 이 접두사만 특별 취급한다.
 */
export type ReviewNote = { forfeited: boolean; text: string };

/**
 * Classes for every element that prints reviewer text (comment, forfeit reason): keeps the reviewer's line breaks and
 * wraps unbroken strings such as long URLs inside the card instead of widening the page. Pair with `min-w-0` on a grid/flex parent.
 */
export const REVIEW_TEXT_CLASS = "whitespace-pre-line break-words [overflow-wrap:anywhere]";

const FORFEIT_PREFIX = /^forfeited:\s*/i;

/** 빈 값/공백만 있으면 null. 몰수 코멘트는 접두사를 떼고 사유만 `text`에 담는다. */
export function parseReviewComment(comment: string | null | undefined): ReviewNote | null {
  const trimmed = comment?.trim();
  if (!trimmed) return null;
  if (FORFEIT_PREFIX.test(trimmed)) {
    const reason = trimmed.replace(FORFEIT_PREFIX, "").trim();
    return { forfeited: true, text: reason };
  }
  return { forfeited: false, text: trimmed };
}
