import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";

type PageLoadingProps = {
  /** Announced to screen readers: the caller's existing translated loading string (no new message keys). */
  label: string;
  /** `page`/`detail` reserve most of a screen so the swap to content does not shift the layout; `list` is section-sized. */
  variant?: "page" | "list" | "detail";
  /** Container classes (page gutters, card chrome) owned by the caller. */
  className?: string;
  /** Custom skeleton blocks (e.g. a detail route's exact geometry) replacing the variant's default bars. */
  children?: ReactNode;
};

const MIN_HEIGHT = { page: "min-h-[60dvh]", detail: "min-h-[60dvh]", list: "min-h-48" } as const;

/** The single loading placeholder for every gated view and `[id]/loading.tsx`: `role="status"` + sr-only label + skeleton bars. */
export function PageLoading({ label, variant = "page", className = "", children }: PageLoadingProps) {
  return (
    <div className={`${MIN_HEIGHT[variant]} ${className}`} role="status">
      <span className="sr-only">{label}</span>
      {children ?? <DefaultBars variant={variant} />}
    </div>
  );
}

function DefaultBars({ variant }: { variant: "page" | "list" | "detail" }) {
  if (variant === "list") {
    return (
      <>
        <Skeleton className="h-5 w-40 max-w-full rounded-control" />
        <Skeleton className="mt-4 h-16" />
        <Skeleton className="mt-3 h-16" />
      </>
    );
  }
  return (
    <>
      <Skeleton className="h-5 w-32 max-w-full rounded-control" />
      <Skeleton className="mt-6 h-12 max-w-2xl rounded-tile" />
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
    </>
  );
}
