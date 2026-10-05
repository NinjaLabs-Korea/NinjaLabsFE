/// <reference types="vite/client" />
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { namespaces } from "@/i18n/messages";

// English messages, loaded synchronously so tests can assert on rendered copy.
const files = import.meta.glob("../../messages/en/*.json", { eager: true, import: "default" }) as Record<
  string,
  Record<string, unknown>
>;

export const enMessages = Object.fromEntries(
  namespaces.map((ns) => [ns, files[`../../messages/en/${ns}.json`] ?? {}]),
);

export function IntlWrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

/** render() wrapped in an English NextIntlClientProvider. */
export function renderWithIntl(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { wrapper: IntlWrapper, ...options });
}
