import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Deliberate long-form prose subset: tables, images, and task lists are unsupported by design
// (unwrapDisallowed keeps their text content). See Bounty/Notice markdown contract in src/lib/types.ts.
const allowedElements = ["p", "a", "strong", "em", "ul", "ol", "li", "h2", "h3", "code", "pre", "blockquote", "br", "del"];

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      allowedElements={allowedElements}
      unwrapDisallowed
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mt-4 first:mt-0 text-base text-ink-secondary">{children}</p>,
        a: ({ href, children }) => {
          const isExternal = typeof href === "string" && (href.startsWith("http") || href.startsWith("//"));
          return (
            <a
              className="font-semibold text-primary-strong underline underline-offset-2 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
  );
}
