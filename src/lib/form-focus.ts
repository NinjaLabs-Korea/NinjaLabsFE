/**
 * After a failed submit, moves focus to the first field marked `aria-invalid` (DOM order) and scrolls it into view, so the
 * error is not left off-screen on a phone. Runs in a frame so React has committed `aria-invalid` first. Choice groups
 * (fieldset with `tabIndex={-1}`) carry the attribute themselves and are focusable for this purpose.
 */
export function focusFirstInvalid(form: HTMLFormElement | null): void {
  if (!form) return;
  requestAnimationFrame(() => {
    const target = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!target) return;
    target.focus({ preventScroll: true });
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView?.({ block: "center", behavior: reduced ? "auto" : "smooth" });
  });
}
