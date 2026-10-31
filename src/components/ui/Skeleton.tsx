/** Decorative placeholder block: hidden from assistive tech (the wrapping `PageLoading` announces). Size via `className`; a `rounded-*` there replaces the default card radius. */
export function Skeleton({ className = "" }: { className?: string }) {
  const radius = /(^|\s)rounded-/.test(className) ? "" : "rounded-card";
  return <div aria-hidden="true" className={`${radius} bg-surface-subtle animate-pulse motion-reduce:animate-none ${className}`} />;
}
