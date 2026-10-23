import { notFound } from "next/navigation";
import { getRuntimeBounty } from "@/lib/bounties";
import { validateDetailId } from "@/lib/detail-id";

// 없는 id는 loading.tsx 스트리밍이 시작되기 전에 여기서 404로 끝낸다.
// 스트리밍이 시작되면 상태 코드가 200으로 고정되기 때문이다 (Next docs: loading.js > Status Codes).
// page.tsx도 같은 조회를 하지만 같은 요청 안의 fetch는 메모이즈되어 API를 두 번 부르지 않는다.
// id 모양부터 확인한다 (api: UUID, mock: slug): 쓰레기 id는 조회 없이 404.
export default async function BountyDetailLayout({ children, params }: LayoutProps<"/[locale]/bounties/[id]">) {
  const { locale, id } = await params;
  if (!(await validateDetailId("bounties", id))) notFound();
  if (!(await getRuntimeBounty(id, locale))) notFound();
  return children;
}
