export default function Loading() {
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20" role="status" aria-label="Loading page">
      <span className="sr-only">Loading page…</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="h-4 w-32 rounded-control bg-surface-subtle" />
        <div className="mt-3 h-14 w-64 max-w-full rounded-tile bg-surface-subtle" />
        <div className="mt-4 h-6 max-w-2xl rounded-control bg-surface-subtle" />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-64 rounded-card border border-border bg-surface-subtle" />
          ))}
        </div>
      </div>
    </div>
  );
}
