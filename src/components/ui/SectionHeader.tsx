import Link from "next/link";

type SectionHeaderProps = {
  eyebrow: string;
  heading: string;
  level?: 1 | 2 | 3;
  size?: "lg" | "xl";
  action?: {
    label: string;
    href: string;
  };
};

const sizeClasses = {
  lg: "font-display text-2xl text-ink",
  xl: "font-display text-5xl -tracking-[0.48px] text-ink",
};

export function SectionHeader({ eyebrow, heading, level = 2, size = "lg", action }: SectionHeaderProps) {
  const Heading = `h${level}` as "h1" | "h2" | "h3";
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{eyebrow}</p>
        <Heading className={sizeClasses[size]}>
          {heading}
        </Heading>
      </div>
      {action ? (
        <Link
          className="shrink-0 rounded-control border border-primary-outline px-[21px] py-3 text-sm leading-[21px] font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href={action.href}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
