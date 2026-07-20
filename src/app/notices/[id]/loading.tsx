export default function Loading() {
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20 animate-pulse">
      <div className="h-5 w-28 rounded-control bg-surface-subtle" />
      <div className="mt-8 h-14 max-w-2xl rounded-tile bg-surface-subtle" />
      <div className="mt-8 h-80 rounded-card bg-surface-subtle" />
      <div className="mt-8 grid gap-8 md:grid-cols-4"><div className="h-96 rounded-card bg-surface-subtle md:col-span-3" /><div className="h-48 rounded-card bg-surface-subtle" /></div>
    </div>
  );
}
