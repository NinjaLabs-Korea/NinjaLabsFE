import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { loadMessages } from "./messages";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  // Formatter time zone (useFormatter/getFormatter dates): fixed so server and client render the same day.
  return { locale, messages: await loadMessages(locale), timeZone: "UTC" };
});
