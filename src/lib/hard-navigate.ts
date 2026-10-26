/** A full page load to a same-site URL (kept in its own module so tests can replace it; jsdom cannot navigate). */
export function hardNavigate(url: string): void {
  window.location.replace(url);
}
