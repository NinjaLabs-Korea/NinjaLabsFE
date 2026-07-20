import Image from "next/image";
import Link from "next/link";

const platformLinks = [
  { href: "/bounties", label: "Bounties" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/notices", label: "Notices" },
];

const communityLinks = [
  { href: "https://x.com/", label: "X / Twitter" },
  { href: "https://discord.com/", label: "Discord" },
];

export function Footer() {
  return (
    <footer className="bg-inverse-surface text-on-inverse">
      <div className="mx-auto max-w-content px-6 pt-12">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div>
            <div className="flex items-center gap-2">
              <Image
                src="/figma/ninja-labs-mascot.svg"
                alt=""
                width={28}
                height={28}
                className="rounded-logo"
              />
              <span className="font-display text-xl font-bold">Ninja Labs</span>
            </div>
            <p className="mt-3 max-w-[287px] text-sm text-ink-muted">
              Build. Complete. Own your track record. On Injective.
            </p>
          </div>

          <div className="flex flex-col gap-8 sm:flex-row sm:gap-12">
            <FooterLinkColumn heading="Platform" links={platformLinks} />
            <FooterLinkColumn heading="Community" links={communityLinks} external />
          </div>
        </div>

        <div className="mt-8 border-t border-on-inverse/8 pt-[25px] pb-12">
          <p className="text-xs leading-4 text-on-inverse-muted">
            © 2026 Ninja Labs · All content viewable without login · Returning users skip Intro and
            land on main.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLinkColumn({
  heading,
  links,
  external = false,
}: {
  heading: string;
  links: { href: string; label: string }[];
  external?: boolean;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-on-inverse/90">{heading}</h2>
      <ul className="mt-2 space-y-2 text-sm leading-5">
        {links.map(({ href, label }) => (
          <li key={label}>
            {external ? (
              <a
                className="text-sm text-on-inverse-secondary"
                href={href}
                target="_blank"
                rel="noreferrer"
              >
                {label}
              </a>
            ) : (
              <Link className="text-sm text-on-inverse-secondary" href={href}>
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
