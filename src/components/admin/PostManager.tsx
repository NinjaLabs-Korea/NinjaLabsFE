"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { AdminTable } from "@/components/admin/AdminTable";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { postCategoryLabelKeys, publishOptionFor, type AdminPost, adminErrorDescription } from "@/lib/admin-helpers";
import { isHttpUrl, isHttpUrlOrMediaPath } from "@/lib/url-rules";
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

/** 저장 전 검증 — BE `CreateNoticeDto`의 거울 (title/body @IsNotEmpty, thumbnailUrl IsHttpUrlOrMediaPath, externalUrl IsHttpUrl) */
type PostFieldErrors = Partial<Record<"title" | "bodyMarkdown" | "thumbnail" | "externalUrl", "required" | "urlInvalid" | "tooLong">>;
/** BE `CreateNoticeDto.body` @MaxLength (a PATCH allows double; the stricter create limit applies to both). */
export const NOTICE_BODY_MAX = 50_000;
export function validatePostForm(input: Pick<PostForm, "title" | "bodyMarkdown" | "thumbnail" | "externalUrl">): PostFieldErrors {
  const errors: PostFieldErrors = {};
  if (!input.title.trim()) errors.title = "required";
  if (!input.bodyMarkdown.trim()) errors.bodyMarkdown = "required";
  else if (input.bodyMarkdown.trim().length > NOTICE_BODY_MAX) errors.bodyMarkdown = "tooLong";
  if (input.thumbnail && !isHttpUrlOrMediaPath(input.thumbnail)) errors.thumbnail = "urlInvalid";
  if (input.externalUrl?.trim() && !isHttpUrl(input.externalUrl.trim())) errors.externalUrl = "urlInvalid";
  return errors;
}

export function PostManager({ posts, children, tabs }: { posts: AdminPost[]; children: ReactNode; tabs: ReactNode }) {
  const api = useAdminApi();
  const t = useTranslations("admin.notices");
  const tCommon = useTranslations("admin.common");
  const categoryLabel = (value: string) => t(`categories.${postCategoryLabelKeys[value as AdminPost["category"]]}`);
  const [records, setRecords] = useState(posts);
  const [mode, setMode] = useState<"create" | string>("create");
  const [form, setForm] = useState<PostForm>(emptyForm);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<PostFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminPost | null>(null);
  const formRef = useRef<HTMLElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const fieldError = (key: keyof PostFieldErrors) =>
    errors[key] ? <span className="mt-1 block text-xs font-normal text-danger" id={`post-${key}-error`} role="alert">{tCommon(errors[key], { max: NOTICE_BODY_MAX })}</span> : null;
  const invalidProps = (key: keyof PostFieldErrors, hintId?: string) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": [errors[key] ? `post-${key}-error` : null, hintId ?? null].filter(Boolean).join(" ") || undefined,
  });

  // Re-reads the list after a write. The write has already succeeded by then, so a failed re-read only says "could not load"
  // (never "save failed": a retry of an already-created notice would create a duplicate).
  const reload = useCallback(
    () => api.getAdminPosts().then(setRecords).catch(() => pushAdminToast({ variant: "danger", title: t("toast.loadFailedTitle"), description: t("toast.loadFailedDescription") })),
    [api, t],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateForm = <K extends keyof PostForm>(key: K, value: PostForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  /** Forgets the picked file, including the native input's own selection (it would keep showing the name, and picking the same file again fires no change). */
  const clearThumbnailFile = () => {
    setThumbnailFile(null);
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
  };

  const startNew = () => {
    setMode("create");
    setForm(emptyForm);
    clearThumbnailFile();
    setErrors({});
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
    clearThumbnailFile();
    setErrors({});
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /** Clears the stored URL and any picked file; the save then sends `thumbnailUrl: null` so the BE drops it. */
  const removeThumbnail = () => {
    updateForm("thumbnail", null);
    clearThumbnailFile();
  };

  const savePost = async () => {
    if (saving) return;
    // A freshly picked file replaces the stored thumbnail, so only the kept URL is checked.
    const nextErrors = validatePostForm({ ...form, thumbnail: thumbnailFile ? null : form.thumbnail });
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      pushAdminToast({ variant: "danger", title: tCommon("saveFailed"), description: tCommon("fixFields") });
      return;
    }
    setSaving(true);
    try {
      const thumbnail = thumbnailFile ? (await api.uploadAdminMedia(thumbnailFile)).url : form.thumbnail;
      // An emptied link is `null` (the API sends it as null so the BE clears the column), never an omitted key.
      const externalUrl = form.externalUrl?.trim() || null;
      const post: AdminPost = { ...form, title: form.title.trim(), externalUrl, thumbnail, slug: mode === "create" ? "" : mode, publishedAt: null };
      // Plain edits omit `publish` so the BE keeps published_at (see publishOptionFor).
      const previousStatus = records.find((item) => item.slug === mode)?.status;
      const options = publishOptionFor(previousStatus, form.status, mode === "create" ? "create" : "edit");
      await api.saveAdminPost(post, mode === "create", options);
      pushAdminToast({ variant: "success", title: mode === "create" ? t("toast.createdTitle") : t("toast.updatedTitle"), description: tCommon("savedDescription", { title: form.title }) });
      startNew();
      await reload();
    } catch (error) {
      pushAdminToast({ variant: "danger", title: tCommon("saveFailed"), description: adminErrorDescription(error, tCommon, t("toast.saveFailedDescription")) });
    } finally {
      setSaving(false);
    }
  };

  const deletePost = async (post: AdminPost) => {
    setPendingDelete(null);
    try {
      await api.deleteAdminPost(post.slug);
      setRecords((current) => current.filter((item) => item.slug !== post.slug));
      // The form may be editing the record that just went away: a later save would PATCH a missing row.
      if (mode === post.slug) startNew();
      pushAdminToast({ variant: "success", title: t("toast.deletedTitle"), description: post.title });
    } catch (error) {
      pushAdminToast({ variant: "danger", title: tCommon("deleteFailed"), description: adminErrorDescription(error, tCommon, t("toast.deleteFailedDescription")) });
    }
  };

  const isEditing = mode !== "create";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-6">
        {children}
        <div className="flex items-center gap-3">
          <Badge variant="neutral">{tCommon("adminOnly")}</Badge>
          <button
            className="h-[45px] rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={startNew}
            type="button"
          >
            {t("newPost")}
          </button>
        </div>
      </div>
      {tabs}
      <div className="mt-6 space-y-6">
      <AdminTable columns={postColumns.map((column) => ({ ...column, label: t(`columns.${column.id}`) }))} minWidthClass="min-w-[820px]">
        {records.map((post) => (
          <tr key={post.slug} className="border-t border-border">
            <td className="px-5 py-4 text-sm font-semibold text-ink">{post.title}</td>
            <td className="px-5 py-4 text-sm text-ink-secondary">{categoryLabel(post.category)}</td>
            <td className="px-5 py-4"><Badge variant={post.status === "published" ? "success" : "warning"}>{t(`statuses.${post.status}`)}</Badge></td>
            <td className="px-5 py-4 text-sm text-ink-secondary">{post.publishedAt ?? "–"}</td>
            <td className="px-5 py-4"><div className="flex gap-2"><button className="h-11 rounded-control border border-primary-outline bg-surface px-3 text-sm font-semibold text-primary-strong" onClick={() => editPost(post)} type="button">{tCommon("edit")}</button><button className="h-11 rounded-control border border-danger px-3 text-sm font-semibold text-danger" onClick={() => setPendingDelete(post)} type="button">{tCommon("delete")}</button></div></td>
          </tr>
        ))}
      </AdminTable>

      <section className="rounded-card border border-border bg-surface p-[21px] shadow-card" ref={formRef}>
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{isEditing ? t("form.eyebrowEdit") : t("form.eyebrowCreate")}</p>
        <h2 className="mt-2 font-display text-2xl tracking-[-0.24px] text-ink">{isEditing ? t("form.titleEdit") : t("form.titleCreate")}</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="text-sm font-semibold text-ink">{t("form.title")}<input {...invalidProps("title")} className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder aria-[invalid]:border-danger" maxLength={200} onChange={(event) => updateForm("title", event.target.value)} placeholder={t("form.titlePlaceholder")} value={form.title} />{fieldError("title")}</label>
          <label className="text-sm font-semibold text-ink">
            {t("form.category")}
            <div className="mt-2"><AdminSelect formatOption={categoryLabel} label={t("form.category")} onChange={(value) => updateForm("category", value as AdminPost["category"])} options={categories} value={form.category} /></div>
          </label>
          <div className="text-sm font-semibold text-ink"><label>{t("form.thumbnail")}<input accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-sm font-normal text-ink-secondary file:mr-3 file:rounded-control file:border file:border-primary-outline file:bg-surface file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-strong" onChange={(event) => { setThumbnailFile(event.target.files?.[0] ?? null); setErrors((current) => ({ ...current, thumbnail: undefined })); }} ref={thumbnailInputRef} type="file" /></label><span className="mt-2 block text-xs font-normal text-ink-muted">{thumbnailFile?.name ?? form.thumbnail ?? tCommon("fileHint")}</span>{form.thumbnail || thumbnailFile ? <button className="mt-2 text-xs font-semibold text-danger hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={removeThumbnail} type="button">{tCommon("removeImage")}</button> : null}{fieldError("thumbnail")}</div>
          <label className="text-sm font-semibold text-ink">{t("form.externalLink")}<input {...invalidProps("externalUrl", "post-externalUrl-hint")} className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder aria-[invalid]:border-danger" inputMode="url" onChange={(event) => updateForm("externalUrl", event.target.value || null)} placeholder={t("form.externalLinkPlaceholder")} type="url" value={form.externalUrl ?? ""} /><span className="mt-1 block text-xs font-normal text-ink-muted" id="post-externalUrl-hint">{tCommon("urlHint")}</span>{fieldError("externalUrl")}</label>
          <label className="md:col-span-2 text-sm font-semibold text-ink">{t("form.body")}<textarea {...invalidProps("bodyMarkdown")} className="mt-2 min-h-[144px] w-full rounded-control border border-border px-4 py-3 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder aria-[invalid]:border-danger" onChange={(event) => updateForm("bodyMarkdown", event.target.value)} placeholder={t("form.bodyPlaceholder")} value={form.bodyMarkdown} />{fieldError("bodyMarkdown")}</label>
          <label className="text-sm font-semibold text-ink">
            {t("form.status")}
            <div className="mt-2"><AdminSelect formatOption={(option) => t(`statuses.${option}`)} label={t("form.status")} onChange={(value) => updateForm("status", value === "published" ? "published" : "draft")} options={statuses} value={form.status} /></div>
          </label>
        </div>
        <button className="mt-5 h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} onClick={savePost} type="button">{saving ? tCommon("saving") : tCommon("save")}</button>
        <p className="mt-3 text-xs text-ink-muted">{tCommon("saveNotice")}</p>
      </section>
      </div>
      <DeleteConfirmDialog onCancel={() => setPendingDelete(null)} onConfirm={() => pendingDelete && void deletePost(pendingDelete)} title={pendingDelete?.title ?? null} />
    </>
  );
}
