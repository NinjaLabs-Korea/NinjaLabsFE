import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Link } from "@/i18n/navigation";
import { stripLocale } from "@/i18n/routing";

// Deliberate long-form prose subset: tables, images, and task lists are unsupported by design
// (unwrapDisallowed keeps their text content). See Bounty/Notice markdown contract in src/lib/types.ts.
// Absolute (any scheme case) or protocol-relative: a bare `startsWith("http")` also matched relative paths like `http-guide`.
const EXTERNAL_HREF = /^(https?:)?\/\//i;

// A same-site path (`/bounties/abc`, not `//host`): rendered through the locale-aware Link, because under `localePrefix: "always"` a raw
// `<a href="/bounties/abc">` drops the reader's locale (one redirect, and the proxy may pick another language).
const SAME_SITE_PATH = /^\/(?!\/)/;

/**
 * A path copied from the address bar already carries a locale (`/en/bounties`); the locale-aware Link would add the reader's
 * locale again (`/en/en/bounties`, a 404). Drop one leading locale segment, keeping the query and hash.
 */
function withoutLocalePrefix(href: string): string {
  const match = /^([^?#]*)(.*)$/.exec(href);
  const path = stripLocale(match?.[1] ?? href);
  return `${path === "" ? "/" : path}${match?.[2] ?? ""}`;
}

// Browsers read a backslash in a URL as a slash (`\\/host` and `/\\host` become `//host`, `https:\\host` becomes `https://host`).
// react-markdown already percent-encodes it (`%5C`, inert) before this component sees the href; this keeps that from being the only
// line of defense. No legitimate link needs one: keep the text, drop the link.
const BACKSLASH_HREF = /\\|%5c/i;

const linkClass = "font-semibold text-primary-strong underline underline-offset-2 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const allowedElements = ["p", "a", "strong", "em", "ul", "ol", "li", "h2", "h3", "code", "pre", "blockquote", "br", "del"];

export function Markdown({ children }: { children: string }) {
  // `overflow-wrap: anywhere`: a long unbroken string (URL, inline code, link text) must wrap inside its card, not widen the page.
  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
    <ReactMarkdown
      allowedElements={allowedElements}
      unwrapDisallowed
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mt-4 first:mt-0 text-base text-ink-secondary">{children}</p>,
        a: ({ href, children }) => {
          if (typeof href === "string" && BACKSLASH_HREF.test(href)) return <>{children}</>;
          const isExternal = typeof href === "string" && EXTERNAL_HREF.test(href);
          if (typeof href === "string" && SAME_SITE_PATH.test(href)) {
            return <Link className={linkClass} href={withoutLocalePrefix(href)}>{children}</Link>;
          }
          return (
            <a
              className={linkClass}
              href={href}
              rel={isExternal ? "noreferrer" : undefined}
              target={isExternal ? "_blank" : undefined}
            >
              {children}
            </a>
          );
        },
        strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
        ul: ({ children }) => <ul className="mt-4 list-disc space-y-1.5 pl-5 text-base text-ink-secondary">{children}</ul>,
        ol: ({ children }) => <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-base text-ink-secondary">{children}</ol>,
        h2: ({ children }) => <h2 className="mt-8 first:mt-0 font-display text-2xl -tracking-[0.24px] text-ink">{children}</h2>,
        h3: ({ children }) => <h3 className="mt-6 first:mt-0 font-display text-lg font-bold text-ink">{children}</h3>,
        code: ({ children }) => <code className="rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-sm text-ink">{children}</code>,
        blockquote: ({ children }) => <blockquote className="mt-4 border-l-2 border-primary-outline pl-4 text-ink-muted">{children}</blockquote>,
        pre: ({ children }) => <pre className="mt-4 overflow-x-auto rounded-tile bg-surface-subtle p-4 font-mono text-sm text-ink">{children}</pre>,
        del: ({ children }) => <del className="text-ink-muted line-through">{children}</del>,
      }}
    >
      {children}
    </ReactMarkdown>
    </div>
  );
}
