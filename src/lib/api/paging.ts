import { fetchPublicJson, PUBLIC_LIST_REVALIDATE_SECONDS } from "@/lib/api/public";

type PageResponse<T> = { items: T[]; total: number };

// BE caps pageSize at 50; list filtering is client-side, so loaders fetch every page up to a safety cap.
export const PUBLIC_PAGE_SIZE = 50;
export const PUBLIC_MAX_PAGES = 20;

/** Loads every page of a public list endpoint; rows are de-duplicated by id in case pages shift while loading. */
export async function fetchAllPublicPages<T extends { id: string }>(path: string): Promise<T[]> {
  const separator = path.includes("?") ? "&" : "?";
  const fetchPage = (page: number) =>
    fetchPublicJson<PageResponse<T>>(`${path}${separator}page=${page}&pageSize=${PUBLIC_PAGE_SIZE}`, { revalidateSeconds: PUBLIC_LIST_REVALIDATE_SECONDS });
  const first = await fetchPage(1);
  const pageCount = Math.min(Math.ceil(first.total / PUBLIC_PAGE_SIZE), PUBLIC_MAX_PAGES);
  const rest = await Promise.all(Array.from({ length: Math.max(pageCount - 1, 0) }, (_, index) => fetchPage(index + 2)));
  const seen = new Set<string>();
  return [first, ...rest].flatMap((response) => response.items).filter((row) => !seen.has(row.id) && Boolean(seen.add(row.id)));
}
