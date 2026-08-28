import { loadRuntimeConfig } from "@/lib/runtime/config";

/** Server-side public API fetcher used by public App Router pages. */
export async function fetchPublicJson<T>(path: string): Promise<T> {
  const config = loadRuntimeConfig();
  if (config.runtimeMode !== "api" || !config.apiUrl) {
    throw new Error("Public API is unavailable in mock mode.");
  }

  const response = await fetch(`${config.apiUrl.replace(/\/$/, "")}${path}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Public API ${response.status}: ${path}`);
  }
  return response.json() as Promise<T>;
}
