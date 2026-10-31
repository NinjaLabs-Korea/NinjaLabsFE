/**
 * 헤더가 모바일 메뉴와 데스크톱 내비로 갈리는 breakpoint(xl)의 단일 출처.
 * 영어 기준 내비 6개 + 언어 + 둘러보기 + 사용자 메뉴가 768px에 들어가지 않아 xl에서 바꾼다.
 * Tailwind가 클래스를 찾을 수 있도록 전체 리터럴로 적는다 (문자열 조합 금지).
 */
export const NAV_DESKTOP_ONLY_FLEX = "hidden xl:flex";
export const NAV_DESKTOP_ONLY_BLOCK = "hidden xl:block";
export const NAV_DESKTOP_ONLY_INLINE = "hidden xl:inline-block";
export const NAV_MOBILE_ONLY = "xl:hidden";
