import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/ui/PageLoading";
import { Skeleton } from "@/components/ui/Skeleton";

export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <PageLoading className="mx-auto max-w-content px-gutter py-16 pb-20" label={t("loading")} variant="detail">
      <Skeleton className="h-5 w-32 rounded-control" />
      <Skeleton className="mt-8 h-14 max-w-2xl rounded-tile" />
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2"><Skeleton className="h-72" /><Skeleton className="h-56" /></div><Skeleton className="h-80" /></div>
    </PageLoading>
  );
}
