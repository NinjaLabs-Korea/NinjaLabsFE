import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { decodeDetailId, validateDetailId } from "@/lib/detail-id";
import { getRuntimeProfile } from "@/lib/members";

// The layout's own notFound() below renders the [locale] boundary without the page's generateMetadata, so a well-formed but
// unknown nickname would fall back to the site's home title. Same not-found title as the page; a found profile returns
// nothing and the page's own metadata applies.
export async function generateMetadata({ params }: LayoutProps<"/[locale]/members/[id]">): Promise<Metadata> {
  const { locale, id: rawId } = await params;
  const id = decodeDetailId(rawId);
  if ((await validateDetailId("members", id)) && (await getRuntimeProfile(id, locale))) return {};
  const t = await getTranslations({ locale, namespace: "members.profile" });
  return { alternates: {}, title: t("notFoundTitle") };
}

// 없는 id는 loading.tsx 스트리밍이 시작되기 전에 여기서 404로 끝낸다.
// 스트리밍이 시작되면 상태 코드가 200으로 고정되기 때문이다 (Next docs: loading.js > Status Codes).
// generateMetadata·page.tsx도 같은 조회를 한다. fetch에 abort signal이 있어 Next의 fetch dedupe는 적용되지 않고,
// 로더를 감싼 React cache()가 한 요청 안에서 BE 호출을 1번으로 묶는다.
// 로더는 BE 404일 때만 undefined를 돌려준다. 5xx·네트워크 오류·타임아웃은 throw되어 스트리밍 전에 error.tsx로 간다.
// id 모양부터 확인한다 (api: nickname, mock: slug): 쓰레기 id는 조회 없이 404.
export default async function MemberProfileLayout({ children, params }: LayoutProps<"/[locale]/members/[id]">) {
  const { locale, id: rawId } = await params;
  const id = decodeDetailId(rawId);
  if (!(await validateDetailId("members", id))) notFound();
  if (!(await getRuntimeProfile(id, locale))) notFound();
  return children;
}
