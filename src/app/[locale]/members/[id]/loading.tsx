import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/ui/PageLoading";
import { Skeleton } from "@/components/ui/Skeleton";

export default async function Loading() {
  const t = await getTranslations("admin.common");
  return (
    <PageLoading className="mx-auto max-w-content px-6 py-16 pb-20" label={t("loading")} variant="detail">
      <Skeleton className="h-36" />
      <Skeleton className="mt-14 h-96 rounded-panel" />
      <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3"><Skeleton className="h-52" /><Skeleton className="h-52" /><Skeleton className="h-52" /></div>
    </PageLoading>
  );
}
