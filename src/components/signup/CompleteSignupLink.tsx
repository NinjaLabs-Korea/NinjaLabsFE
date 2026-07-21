import type { ReactNode } from "react";
import Link from "next/link";

type CompleteSignupLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  external?: boolean;
};

export function CompleteSignupLink({ href, className, children, external = false }: CompleteSignupLinkProps) {
  if (external) {
    return (
      <a className={className} href={href} rel="noreferrer" target="_blank">
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}
