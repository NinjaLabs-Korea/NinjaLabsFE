/**
 * 어드민/제출 URL 입력 규칙 — NinjaLabsBE `src/common/validation/url.ts`의 거울. 전부 http(s)만 허용한다
 * (`javascript:`/`data:` 차단). BE가 바뀌면 여기와 `src/test/url-rules.test.ts`(BE `url.spec.ts`와 같은 probe)를 함께 고칠 것.
 *
 *   isHttpUrl               외부 링크 (externalUrl, portfolioUrl, submissionUrl, repositoryUrl) — BE `IsHttpUrl`
 *   isHttpUrlOrMediaPath    이미지 — `POST /admin/media`가 돌려주는 `/media/<uuid>`도 허용 (thumbnailUrl, imageUrl, coverImageUrl)
 *   isHttpUrlOrSitePath     사이트 내부 라우트 `/bounties/<slug>`도 허용 (highlight linkUrl). `//host`는 거부
 *   isSafeUrl               수정(PATCH) DTO의 완화 규칙 `IsSafeUrl` — 이미 저장된 레거시 값이 수정을 막는지 판정할 때만 쓴다 (입력 검증에는 위 엄격 규칙)
 *
 * BE의 isHttpUrl은 `new URL` 검사 뒤에 validator.js `isURL({ protocols: http/https, require_protocol, require_tld: false,
 * disallow_auth })`를 한 번 더 거친다. 의존성 없이 같은 결과를 내기 위해 그 검사가 추가로 거르는 것을 명시적으로 확인한다:
 * authority의 `@`, 공백/`<>`, 그리고 호스트 규칙(validator `isFQDN`/`isIP`, 원문 기준 — `new URL`은 `1.2.3`을 `1.2.0.3`으로,
 * 전각 문자를 ASCII로 정규화해 버리므로 정규화 전 문자열을 본다): 라벨 1~63자, `[a-z0-9\u00a1-\uffff-]`만(밑줄·전각·역슬래시
 * 불가), 라벨 처음/끝 하이픈 불가, 끝 점(`example.com.`) 불가, 숫자만인 마지막 라벨(`1.2.3`, `0x7f.1`, `127.1`) 불가,
 * IPv4는 점 4개의 10진 옥텟만, 포트는 1~65535.
 */
const MAX_URL_LENGTH = 2048;
const MEDIA_PATH = /^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** `/`로 시작하고 `//`로 시작하지 않으며 공백·역슬래시가 없다 — 세그먼트 검사는 isSitePath가 이어서 한다 */
const SITE_PATH = /^\/(?!\/)[^\s\\]*$/;
const HTTP_URL_PREFIX = /^https?:\/\/[^/?#\\]/i;
const ENCODED_SLASH = /%(2f|5c)/i;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const WHITESPACE_OR_ANGLE = /[\s<>]/;
/** validator.js `isIP(v4)`: four decimal octets 0-255, no leading zeros, no shorthand. */
const IPV4_SEGMENT = "(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])";
const IPV4 = new RegExp(`^(?:${IPV4_SEGMENT}\\.){3}${IPV4_SEGMENT}$`);
const WRAPPED_IPV6 = /^\[([^\]]+)\](?::([0-9]+))?$/;
const FQDN_LABEL = /^[a-z_\u00a1-\uffff0-9-]+$/i;
const FULL_WIDTH = /[\uff01-\uff5e]/;

/** validator.js `isFQDN(host, { require_tld: false, allow_underscores: false, allow_trailing_dot: false, allow_numeric_tld: false })` */
function isFqdn(host: string): boolean {
  const labels = host.split(".");
  if (/^\d+$/.test(labels[labels.length - 1])) return false;
  return labels.every(
    (label) => label.length > 0 && label.length <= 63 && FQDN_LABEL.test(label) && !FULL_WIDTH.test(label) && !/^-|-$/.test(label) && !label.includes("_"),
  );
}

function isValidPort(port: string | undefined): boolean {
  if (port === undefined || port.length === 0) return true;
  if (!/^[0-9]+$/.test(port)) return false;
  const value = Number.parseInt(port, 10);
  return value > 0 && value <= 65535;
}

/** validator.js `isURL` host/port rules on the raw authority (`@` already excluded by the caller). */
function isValidAuthority(authority: string): boolean {
  const ipv6 = WRAPPED_IPV6.exec(authority);
  // A bracketed IPv6 literal was already parsed by `new URL` (stricter than validator's regex); only the port is left.
  if (ipv6) return isValidPort(ipv6[2]);
  const [host, ...rest] = authority.split(":");
  if (!isValidPort(rest.length ? rest.join(":") : undefined)) return false;
  return IPV4.test(host) || isFqdn(host);
}

/** http(s) + `//` + 호스트 — userinfo(`user:pw@`)와 `https:example.com`/`https:/x` 같은 변형은 거부 */
export function isHttpUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH || !HTTP_URL_PREFIX.test(value)) return false;
  if (CONTROL_CHARS.test(value) || WHITESPACE_OR_ANGLE.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password || !url.hostname) return false;
  // validator.js `disallow_auth`: authority(`//` 다음부터 `/?#` 전까지)에 `@`가 있으면 거부 (`https://@host`도 포함)
  const authority = value.slice(value.indexOf("//") + 2).split(/[/?#]/, 1)[0];
  if (authority.includes("@")) return false;
  if (!isValidAuthority(authority)) return false;
  return url.protocol === "http:" || url.protocol === "https:";
}

export function isMediaPath(value: unknown): boolean {
  return typeof value === "string" && MEDIA_PATH.test(value);
}

function percentDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** 세그먼트(원문·디코딩본·`;` 앞부분)가 `.` 또는 `..`로 해석될 수 있는가 */
function isDotSegment(segment: string): boolean {
  const decoded = percentDecode(segment);
  if (decoded === null) return true; // 깨진 퍼센트 인코딩은 거부
  if (CONTROL_CHARS.test(decoded) || /[/\\]/.test(decoded) || ENCODED_SLASH.test(decoded)) return true;
  const forms = [segment, decoded, segment.split(";")[0], decoded.split(";")[0]];
  return forms.some((form) => form === ".." || form === ".");
}

export function isSitePath(value: unknown): boolean {
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH || !SITE_PATH.test(value)) return false;
  if (CONTROL_CHARS.test(value) || ENCODED_SLASH.test(value)) return false;
  const path = value.split(/[?#]/, 1)[0];
  return path.split("/").slice(1).every((segment) => !isDotSegment(segment));
}

export const isHttpUrlOrMediaPath = (value: unknown): boolean => isHttpUrl(value) || isMediaPath(value);
export const isHttpUrlOrSitePath = (value: unknown): boolean => isHttpUrl(value) || isSitePath(value);

/** BE `LENIENT_SITE_PATH` / `BARE_HOST_URL` / `ABSOLUTE_AUTHORITY_BACKSLASH` (url.ts `isSafeUrl`). */
const LENIENT_SITE_PATH = /^\/(?![/\\])/;
const BARE_HOST_URL = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:[/?#][^\s\\]*)?$/i;
const ABSOLUTE_AUTHORITY_BACKSLASH = /^[a-z]+:\/\/[^/?#]*\\/i;

/**
 * BE `isSafeUrl`: the relaxed rule of the PATCH DTOs - an http(s) URL with a host, any `/path`, or a scheme-less bare host (rows saved
 * before the strict rules existed). A stored value that passes this is still accepted when an edit sends it back unchanged.
 */
export function isSafeUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_URL_LENGTH || CONTROL_CHARS.test(value)) return false;
  if (LENIENT_SITE_PATH.test(value) || BARE_HOST_URL.test(value)) return true;
  if (!HTTP_URL_PREFIX.test(value) || /\s/.test(value) || ABSOLUTE_AUTHORITY_BACKSLASH.test(value)) return false;
  try {
    const url = new URL(value);
    return Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}
