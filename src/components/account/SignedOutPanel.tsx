import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export function SignedOutPanel({ message }: { message: string }) {
  const t = useTranslations("account.signedOut");
  return (
    <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
      <p className="text-sm font-semibold text-ink">{message}</p>
      <p className="mt-1 text-sm text-ink-muted">{t("body")}</p>
      <Link
        className="mt-4 inline-block rounded-control bg-primary px-[21px] py-3 text-sm leading-[21px] font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href="/signup"
      >
        {t("cta")}
      </Link>
    </div>
  );
}
