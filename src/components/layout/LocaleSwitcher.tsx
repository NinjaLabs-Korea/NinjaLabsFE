"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
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

  const switchTo = (next: Locale) => {
    menu.closeMenu(true);
    if (next === locale) return;
    startTransition(() => {
      router.replace(`${pathname}${window.location.search}`, { locale: next });
    });
  };

  return (
    <div className="relative" {...menu.rootProps}>
      <button
        {...menu.buttonProps(routing.locales.indexOf(locale))}
        aria-label={t("label")}
        className={`flex items-center gap-1.5 rounded-control px-3 py-3 text-sm leading-[21px] font-semibold hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 ${menu.open ? "text-ink" : "text-ink-secondary"}`}
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
    </div>
  );
}
