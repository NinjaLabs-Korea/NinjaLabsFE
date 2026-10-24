"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;
const getClientTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
// The server has no idea where the admin sits; it renders UTC (labelled) and hydration reads the same value before
// switching to the browser zone, so the HTML never mismatches (same approach as `useAuthSnapshot`).
const getServerTimeZone = () => "UTC";

/** The admin's IANA time zone on the client, `"UTC"` on the server and during hydration. */
export function useBrowserTimeZone(): string {
  return useSyncExternalStore(subscribe, getClientTimeZone, getServerTimeZone);
}
