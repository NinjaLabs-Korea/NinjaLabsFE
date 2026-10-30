"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useUnsavedInputGuard } from "@/components/layout/useUnsavedInputGuard";
import { menuItemBaseClass, menuItemClass, menuPanelClass, useMenuButton } from "@/components/layout/useMenuButton";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeLabels, routing, type Locale } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("common.localeSwitcher");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const menu = useMenuButton(routing.locales.length);

  const { hasUnsavedInput } = useUnsavedInputGuard();
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);

  const navigateTo = (next: Locale) => {
    startTransition(() => {
      // Keep query and hash: /auth/callback#loginCode must survive a locale switch.
      router.replace(`${pathname}${window.location.search}${window.location.hash}`, { locale: next });
    });
  };

  const switchTo = (next: Locale) => {
    menu.closeMenu(true);
    if (next === locale) return;
    // A locale switch remounts the page, so typed form text would be lost silently: ask first.
    if (hasUnsavedInput()) {
      setPendingLocale(next);
      return;
    }
    navigateTo(next);
  };

  return (
    <div className="relative" {...menu.rootProps}>
      <button
        {...menu.buttonProps(routing.locales.indexOf(locale))}
        aria-label={t("label")}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-control px-2 py-3 text-sm sm:px-3 leading-[21px] font-semibold hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 ${menu.open ? "text-ink" : "text-ink-secondary"}`}
        disabled={pending}
      >
        {localeLabels[locale]}
        <span aria-hidden="true" className="text-xs text-ink-muted">{menu.open ? "▴" : "▾"}</span>
      </button>

      {menu.open ? (
        <div className={`${menuPanelClass} w-36`} {...menu.menuProps} aria-label={t("label")}>
          {routing.locales.map((l, index) => (
            <button
              // key must precede the spread; otherwise JSX falls back to createElement and warns about the children.
              key={l}
              {...menu.itemProps(index)}
              aria-checked={l === locale}
              className={l === locale ? `${menuItemBaseClass} font-semibold text-ink` : menuItemClass}
              lang={l}
              onClick={() => switchTo(l)}
              role="menuitemradio"
              type="button"
            >
              {localeLabels[l]}
              {l === locale ? <span aria-hidden="true" className="text-primary">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      <ConfirmDialog
        cancelLabel={t("unsaved.cancel")}
        confirmLabel={t("unsaved.confirm")}
        description={t("unsaved.body")}
        eyebrow={t("label")}
        onCancel={() => setPendingLocale(null)}
        onConfirm={() => {
          const next = pendingLocale;
          setPendingLocale(null);
          if (next) navigateTo(next);
        }}
        open={pendingLocale !== null}
        title={t("unsaved.title")}
      />
    </div>
  );
}
