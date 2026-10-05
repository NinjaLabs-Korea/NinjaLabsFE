"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { AdminTable } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/Badge";
import { postCategoryLabelKeys, type AdminPost } from "@/lib/admin";
import { useAdminApi } from "@/components/auth/FoundationProvider";

const postColumns = [
  { id: "title", widthClass: "w-[35%]" },
  { id: "category", widthClass: "w-[22%]" },
  { id: "status", widthClass: "w-[15%]" },
  { id: "published", widthClass: "w-[14%]" },
  { id: "action", widthClass: "w-[14%]" },
];

const categories: AdminPost["category"][] = ["Ninja Labs", "Injective ecosystem", "Events", "Recruitment", "Other"];
const statuses: AdminPost["status"][] = ["draft", "published"];

type PostForm = Pick<AdminPost, "title" | "category" | "thumbnail" | "externalUrl" | "bodyMarkdown" | "status">;

const emptyForm: PostForm = {
  title: "",
  category: "Ninja Labs",
  thumbnail: null,
  externalUrl: null,
  bodyMarkdown: "",
  status: "draft",
};

export function PostManager({ posts }: { posts: AdminPost[] }) {
  const api = useAdminApi();
  const t = useTranslations("admin.notices");
  const tCommon = useTranslations("admin.common");
  const categoryLabel = (value: string) => t(`categories.${postCategoryLabelKeys[value as AdminPost["category"]]}`);
  const [records, setRecords] = useState(posts);
  const [mode, setMode] = useState<"create" | string>("create");
  const [form, setForm] = useState<PostForm>(emptyForm);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const formRef = useRef<HTMLElement>(null);

  useEffect(() => {
    api.getAdminPosts().then(setRecords).catch(() => pushAdminToast({ variant: "danger", title: t("toast.loadFailedTitle"), description: t("toast.loadFailedDescription") }));
  }, [api, t]);

  const updateForm = <K extends keyof PostForm>(key: K, value: PostForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const startNew = () => {
    setMode("create");
    setForm(emptyForm);
    setThumbnailFile(null);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const editPost = (post: AdminPost) => {
    setMode(post.slug);
    setForm({
      title: post.title,
      category: post.category,
      thumbnail: post.thumbnail,
      externalUrl: post.externalUrl,
      bodyMarkdown: post.bodyMarkdown,
      status: post.status,
    });
    setThumbnailFile(null);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const savePost = async () => {
    try {
      const thumbnail = thumbnailFile ? (await api.uploadAdminMedia(thumbnailFile)).url : form.thumbnail;
      const post: AdminPost = { ...form, thumbnail, slug: mode === "create" ? "" : mode, publishedAt: null };
      await api.saveAdminPost(post, mode === "create");
      setRecords(await api.getAdminPosts());
      pushAdminToast({ variant: "success", title: mode === "create" ? t("toast.createdTitle") : t("toast.updatedTitle"), description: tCommon("savedDescription", { title: form.title }) });
      startNew();
    } catch {
      pushAdminToast({ variant: "danger", title: tCommon("saveFailed"), description: t("toast.saveFailedDescription") });
    }
  };

  const deletePost = async (post: AdminPost) => {
    if (!window.confirm(tCommon("deleteConfirm", { title: post.title }))) return;
    try {
      await api.deleteAdminPost(post.slug);
      setRecords((current) => current.filter((item) => item.slug !== post.slug));
      pushAdminToast({ variant: "success", title: t("toast.deletedTitle"), description: post.title });
    } catch {
      pushAdminToast({ variant: "danger", title: tCommon("deleteFailed"), description: t("toast.deleteFailedDescription") });
    }
  };

  const isEditing = mode !== "create";

  return (
    <div className="mt-6 space-y-6">
      <div className="absolute right-6 top-16">
        <button
          className="h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={startNew}
          type="button"
        >
          {t("newPost")}
        </button>
      </div>
      <AdminTable columns={postColumns.map((column) => ({ ...column, label: t(`columns.${column.id}`) }))} minWidthClass="min-w-[820px]">
        {records.map((post) => (
          <tr key={post.slug} className="border-t border-border">
            <td className="px-5 py-4 text-sm font-semibold text-ink">{post.title}</td>
            <td className="px-5 py-4 text-sm text-ink-secondary">{categoryLabel(post.category)}</td>
            <td className="px-5 py-4"><Badge variant={post.status === "published" ? "success" : "warning"}>{t(`statuses.${post.status}`)}</Badge></td>
            <td className="px-5 py-4 text-sm text-ink-secondary">{post.publishedAt ?? "–"}</td>
            <td className="px-5 py-4"><div className="flex gap-2"><button className="h-11 rounded-control border border-primary-outline bg-surface px-3 text-sm font-semibold text-primary-strong" onClick={() => editPost(post)} type="button">{tCommon("edit")}</button><button className="h-11 rounded-control border border-danger px-3 text-sm font-semibold text-danger" onClick={() => deletePost(post)} type="button">{tCommon("delete")}</button></div></td>
          </tr>
        ))}
      </AdminTable>

      <section className="rounded-card border border-border bg-surface p-5 shadow-card" ref={formRef}>
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{isEditing ? t("form.eyebrowEdit") : t("form.eyebrowCreate")}</p>
        <h2 className="font-display text-2xl tracking-[-0.24px] text-ink">{isEditing ? t("form.titleEdit") : t("form.titleCreate")}</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="text-sm font-semibold text-ink">{t("form.title")}<input className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" onChange={(event) => updateForm("title", event.target.value)} placeholder={t("form.titlePlaceholder")} value={form.title} /></label>
          <label className="text-sm font-semibold text-ink">
            {t("form.category")}
            <div className="mt-2"><AdminSelect formatOption={categoryLabel} label={t("form.category")} onChange={(value) => updateForm("category", value as AdminPost["category"])} options={categories} value={form.category} /></div>
          </label>
          <label className="text-sm font-semibold text-ink">{t("form.thumbnail")}<input accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-sm font-normal text-ink-secondary file:mr-3 file:rounded-control file:border file:border-primary-outline file:bg-surface file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-strong" onChange={(event) => setThumbnailFile(event.target.files?.[0] ?? null)} type="file" /><span className="mt-2 block text-xs font-normal text-ink-muted">{thumbnailFile?.name ?? form.thumbnail ?? tCommon("fileHint")}</span></label>
          <label className="text-sm font-semibold text-ink">{t("form.externalLink")}<input className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" onChange={(event) => updateForm("externalUrl", event.target.value || null)} placeholder="https://" value={form.externalUrl ?? ""} /></label>
          <label className="md:col-span-2 text-sm font-semibold text-ink">{t("form.body")}<textarea className="mt-2 min-h-[144px] w-full rounded-control border border-border px-4 py-3 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" onChange={(event) => updateForm("bodyMarkdown", event.target.value)} placeholder={t("form.bodyPlaceholder")} value={form.bodyMarkdown} /></label>
          <label className="text-sm font-semibold text-ink">
            {t("form.status")}
            <div className="mt-2"><AdminSelect formatOption={(option) => t(`statuses.${option}`)} label={t("form.status")} onChange={(value) => updateForm("status", value === "published" ? "published" : "draft")} options={statuses} value={form.status} /></div>
          </label>
        </div>
        <button className="mt-5 h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={savePost} type="button">{tCommon("save")}</button>
        <p className="mt-3 text-xs text-ink-muted">{tCommon("saveNotice")}</p>
      </section>
    </div>
  );
}
