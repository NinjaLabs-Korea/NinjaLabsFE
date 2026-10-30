import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/ui/PageLoading";
import { Skeleton } from "@/components/ui/Skeleton";

export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <PageLoading className="mx-auto max-w-content px-6 py-16 pb-20" label={t("loading")} variant="detail">
      <Skeleton className="h-5 w-28 rounded-control" />
      <Skeleton className="mt-8 h-14 max-w-2xl rounded-tile" />
      <Skeleton className="mt-8 h-80" />
      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-4"><Skeleton className="h-96 md:col-span-3" /><Skeleton className="h-48" /></div>
    </PageLoading>
  );
}
