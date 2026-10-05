export default function Loading() {
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20 animate-pulse">
      <div className="h-5 w-32 rounded-control bg-surface-subtle" />
      <div className="mt-8 h-14 max-w-2xl rounded-tile bg-surface-subtle" />
      <div className="mt-8 grid gap-6 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2"><div className="h-72 rounded-card bg-surface-subtle" /><div className="h-56 rounded-card bg-surface-subtle" /></div><div className="h-80 rounded-card bg-surface-subtle" /></div>
    </div>
  );
}
