export default function Loading() {
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20 animate-pulse">
      <div className="h-36 rounded-card bg-surface-subtle" />
      <div className="mt-14 h-96 rounded-panel bg-surface-subtle" />
      <div className="mt-14 grid gap-5 md:grid-cols-3"><div className="h-52 rounded-card bg-surface-subtle" /><div className="h-52 rounded-card bg-surface-subtle" /><div className="h-52 rounded-card bg-surface-subtle" /></div>
    </div>
  );
}
