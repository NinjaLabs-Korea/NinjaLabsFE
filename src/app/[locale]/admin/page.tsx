import { redirect } from "@/i18n/navigation";

export default async function AdminIndex({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  redirect({ href: "/admin/users", locale });
}
