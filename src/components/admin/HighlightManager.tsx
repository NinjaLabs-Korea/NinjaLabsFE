"use client";

import { useTranslations } from "next-intl";
import { useCallback, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AdminListStatus } from "@/components/admin/AdminListStatus";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { AdminTable } from "@/components/admin/AdminTable";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { useAdminList } from "@/components/admin/useAdminList";
import { Badge } from "@/components/ui/Badge";
import { DISPLAY_ORDER_MAX, highlightPublishOptionFor, highlightTypeLabelKey, type AdminHighlight, adminErrorDescription } from "@/lib/admin-helpers";
import { HIGHLIGHT_TYPE_CODES, isHighlightTypeCode } from "@/lib/api/codecs";
import { isHttpUrlOrMediaPath, isHttpUrlOrSitePath, isSafeUrl } from "@/lib/url-rules";
import { useAdminApi } from "@/components/auth/FoundationProvider";

/**
 * 저장 전 검증 — BE `CreateHighlightDto`의 거울 (title/description @IsNotEmpty, imageUrl IsHttpUrlOrMediaPath, linkUrl IsHttpUrlOrSitePath, displayOrder @IsInt @Min(0) @MaxPgInt).
 * `stored`(수정할 행의 저장된 이미지/링크)와 같고 BE 완화 규칙(`isSafeUrl`)을 통과하는 값은 URL 검사를 건너뛴다:
 * 수정 DTO는 레거시 행을 위해 완화 규칙(`IsSafeUrl`)이라 엄격 규칙 이전에 저장된 `/uploads/x.png` 같은 값을 그대로 받는데,
 * 여기서 막으면 그 행은 이미지를 지워야만 저장된다.
 */
type HighlightFieldErrors = Partial<Record<"title" | "description" | "image" | "link" | "order", "required" | "urlInvalid" | "orderInvalid">>;
export function validateHighlightForm(
  input: { title: string; description: string; image: string | null; link: string; order: number },
  stored?: { image: string | null; link: string | undefined },
): HighlightFieldErrors {
  const errors: HighlightFieldErrors = {};
  if (!input.title.trim()) errors.title = "required";
  if (!input.description.trim()) errors.description = "required";
  if (input.image && !isHttpUrlOrMediaPath(input.image) && !(input.image === stored?.image && isSafeUrl(input.image))) errors.image = "urlInvalid";
  if (input.link.trim() && !isHttpUrlOrSitePath(input.link.trim()) && !(input.link.trim() === stored?.link && isSafeUrl(stored.link))) errors.link = "urlInvalid";
  if (!Number.isInteger(input.order) || input.order < 0 || input.order > DISPLAY_ORDER_MAX) errors.order = "orderInvalid";
  return errors;
}

const highlightColumns = [
  { id: "type", widthClass: "w-[22%]" },
  { id: "title", widthClass: "w-[32%]" },
  { id: "order", widthClass: "w-[12%]" },
  { id: "link", widthClass: "w-[18%]" },
  { id: "action", widthClass: "w-[16%]" },
];

const publishStates = ["published", "draft"] as const;
const DEFAULT_TYPE: AdminHighlight["type"] = "MILESTONE";

type HighlightManagerProps = {
  highlights: AdminHighlight[];
};

export function HighlightManager({ highlights }: HighlightManagerProps) {
  const api = useAdminApi();
  const t = useTranslations("admin.hallOfFame.highlights");
  const tCommon = useTranslations("admin.common");
  // Unknown BE codes (a type this FE does not know yet) render as the raw code and stay selectable as themselves.
  const typeLabel = (value: string) => {
    const key = highlightTypeLabelKey(value);
    return key ? t(`types.${key}`) : value;
  };
  const [mode, setMode] = useState<"create" | string>("create");
  const [type, setType] = useState<AdminHighlight["type"]>(DEFAULT_TYPE);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [order, setOrder] = useState(0);
  const [published, setPublished] = useState(true);
  const [errors, setErrors] = useState<HighlightFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminHighlight | null>(null);
  const formRef = useRef<HTMLElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const typeOptions = isHighlightTypeCode(type) ? HIGHLIGHT_TYPE_CODES : [type, ...HIGHLIGHT_TYPE_CODES];

  const clearError = (key: keyof HighlightFieldErrors) => setErrors((current) => ({ ...current, [key]: undefined }));
  const fieldError = (key: keyof HighlightFieldErrors) =>
    errors[key] ? <span className="mt-1 block text-xs font-normal text-danger" id={`highlight-${key}-error`} role="alert">{tCommon(errors[key])}</span> : null;
  const invalidProps = (key: keyof HighlightFieldErrors, hintId?: string) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": [errors[key] ? `highlight-${key}-error` : null, hintId ?? null].filter(Boolean).join(" ") || undefined,
  });

  // `reload` re-reads the list after a write. The write has already succeeded by then, so a failed re-read only says "could not load"
  // (never "save failed": a retry of an already-created highlight would create a duplicate).
  const fetchHighlights = useCallback(() => api.getAdminHighlights().then(sortHighlights), [api]);
  const toastLoadFailed = useCallback(() => pushAdminToast({ variant: "danger", title: t("toast.loadFailedTitle"), description: t("toast.loadFailedDescription") }), [t]);
  const { records, setRecords, loadState, reload, retry } = useAdminList(fetchHighlights, sortHighlights(highlights), toastLoadFailed);

  const isEditing = mode !== "create";

  /** Forgets the picked file, including the hidden input's own selection (picking the same file again would fire no change). */
  function clearImageFile() {
    setImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function resetForm() {
    setMode("create");
    setType(DEFAULT_TYPE);
    setTitle("");
    setDescription("");
    setImage(null);
    clearImageFile();
    setLink("");
    setOrder(0);
    setPublished(true);
    setErrors({});
  }

  function handleAdd() {
    resetForm();
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleEdit(highlight: AdminHighlight) {
    setMode(highlight.id);
    setType(highlight.type);
    setTitle(highlight.title);
    setDescription(highlight.description ?? "");
    setImage(highlight.image);
    clearImageFile();
    setLink(highlight.link ?? "");
    setOrder(highlight.order);
    setPublished(highlight.published ?? false);
    setErrors({});
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    setImageFile(event.target.files?.[0] ?? null);
    clearError("image");
  }

  /** Clears both the stored URL and a picked file: the save then sends `imageUrl: null` so the BE drops the image. */
  function handleRemoveImage() {
    setImage(null);
    clearImageFile();
    clearError("image");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    // A freshly picked file replaces the stored image, so only the kept URL is checked.
    const stored = isEditing ? records.find((item) => item.id === mode) : undefined;
    const nextErrors = validateHighlightForm({ title, description, image: imageFile ? null : image, link, order }, stored && { image: stored.image, link: stored.link });
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      pushAdminToast({ variant: "danger", title: tCommon("saveFailed"), description: tCommon("fixFields") });
      return;
    }
    setSaving(true);
    try {
      const uploadedImage = imageFile ? (await api.uploadAdminMedia(imageFile)).url : image;
      const trimmedLink = link.trim();
      // The loaded row decides what an edit must send: `publish` only when the state toggled, `type` only when changed.
      const current = isEditing ? records.find((item) => item.id === mode) : undefined;
      const record: AdminHighlight = {
        id: isEditing ? mode : "", // create: the BE assigns the id
        type,
        title: title.trim(),
        description: description.trim(),
        image: uploadedImage,
        order,
        published,
        ...(trimmedLink ? { link: trimmedLink } : {}),
      };
      await api.saveAdminHighlight(record, !isEditing, {
        ...highlightPublishOptionFor(current?.published, published, isEditing ? "edit" : "create"),
        typeChanged: isEditing && type !== current?.type,
      });
      pushAdminToast({ variant: "success", title: isEditing ? t("toast.updatedTitle") : t("toast.addedTitle"), description: tCommon("savedDescription", { title }) });
      resetForm();
      await reload();
    } catch (error) {
      pushAdminToast({ variant: "danger", title: tCommon("saveFailed"), description: adminErrorDescription(error, tCommon, t("toast.saveFailedDescription")) });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(highlight: AdminHighlight) {
    setPendingDelete(null);
    try {
      await api.deleteAdminHighlight(highlight.id);
      setRecords((current) => current.filter((item) => item.id !== highlight.id));
      // The form may be editing the record that just went away: a later save would PATCH a missing row.
      if (mode === highlight.id) resetForm();
      pushAdminToast({ variant: "success", title: t("toast.deletedTitle"), description: highlight.title });
    } catch (error) {
      pushAdminToast({ variant: "danger", title: tCommon("deleteFailed"), description: adminErrorDescription(error, tCommon, t("toast.deleteFailedDescription")) });
      // The row may be gone already (another admin deleted it) or have changed: show the server's list, not the stale one.
      void reload();
    }
  }

  return (
    <>
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("eyebrow")}</p>
            <h2 className="font-display text-2xl tracking-[-0.24px] text-ink">{t("title")}</h2>
          </div>
          <button className="h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={handleAdd} type="button">{t("addItem")}</button>
        </div>
        <div className="mt-6">
          <AdminListStatus failedText={t("toast.loadFailedDescription")} onRetry={retry} state={loadState} />
          {loadState === "ready" ? (
          <AdminTable columns={highlightColumns.map((column) => ({ ...column, label: t(`columns.${column.id}`) }))} minWidthClass="min-w-[760px]">
            {records.map((highlight) => (
              <tr key={highlight.id} className="border-t border-border">
                <td className="px-5 py-4 text-sm text-ink-secondary">{typeLabel(highlight.type)}</td>
                <td className="px-5 py-4 text-sm font-semibold text-ink">
                  {highlight.title}
                  <span className="mt-1 block"><Badge variant={highlight.published ? "success" : "neutral"}>{t(`publishStates.${highlight.published ? "published" : "draft"}`)}</Badge></span>
                </td>
                <td className="px-5 py-4 text-sm text-ink-secondary">{highlight.order}</td>
                <td className="px-5 py-4 text-sm text-ink-secondary">{highlight.link ?? "–"}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-2"><button className="h-11 rounded-control border border-primary-outline bg-surface px-3 text-sm font-semibold text-primary-strong" onClick={() => handleEdit(highlight)} type="button">{tCommon("edit")}</button><button className="h-11 rounded-control border border-danger px-3 text-sm font-semibold text-danger" onClick={() => setPendingDelete(highlight)} type="button">{tCommon("delete")}</button></div>
                </td>
              </tr>
            ))}
          </AdminTable>
          ) : null}
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-[21px] shadow-card" ref={formRef}>
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{isEditing ? t("form.eyebrowEdit") : t("form.eyebrowCreate")}</p>
        <h2 className="mt-2 font-display text-2xl tracking-[-0.24px] text-ink">{isEditing ? t("form.titleEdit") : t("form.titleCreate")}</h2>
        <form noValidate onSubmit={handleSubmit}>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="text-sm font-semibold text-ink">
              {t("form.type")}
              <div className="mt-2">
                <AdminSelect formatOption={typeLabel} label={t("form.type")} onChange={setType} options={typeOptions} value={type} />
              </div>
            </div>
            <label className="text-sm font-semibold text-ink">{t("form.title")}<input {...invalidProps("title")} className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder aria-[invalid]:border-danger" maxLength={200} onChange={(event) => { setTitle(event.target.value); clearError("title"); }} placeholder={t("form.titlePlaceholder")} required value={title} />{fieldError("title")}</label>
            <label className="text-sm font-semibold text-ink md:col-span-2">{t("form.description")}<textarea {...invalidProps("description")} className="mt-2 min-h-24 w-full rounded-control border border-border px-4 py-3 text-sm font-normal text-ink-secondary aria-[invalid]:border-danger" maxLength={2000} onChange={(event) => { setDescription(event.target.value); clearError("description"); }} required value={description} />{fieldError("description")}</label>
            <div className="text-sm font-semibold text-ink">{t("form.image")}
              <button className="mt-2 flex h-[46px] w-full items-center rounded-control border border-border px-4 text-left text-sm font-normal text-ink-placeholder hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => imageInputRef.current?.click()} type="button">{image ?? t("form.uploadImage")}</button>
              <input accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleImageChange} ref={imageInputRef} type="file" />
              <span className="mt-2 block text-xs font-normal text-ink-muted">{imageFile?.name ?? image ?? tCommon("fileHint")}</span>
              {image || imageFile ? <button className="mt-2 text-xs font-semibold text-danger hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={handleRemoveImage} type="button">{t("form.removeImage")}</button> : null}
              {fieldError("image")}
            </div>
            <label className="text-sm font-semibold text-ink">{t("form.link")} <span className="font-normal text-ink-muted">{t("form.optional")}</span><input {...invalidProps("link", "highlight-link-hint")} className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder aria-[invalid]:border-danger" inputMode="url" onChange={(event) => { setLink(event.target.value); clearError("link"); }} placeholder={t("form.linkPlaceholder")} type="url" value={link} /><span className="mt-1 block text-xs font-normal text-ink-muted" id="highlight-link-hint">{tCommon("urlHint")}</span>{fieldError("link")}</label>
            <label className="text-sm font-semibold text-ink">{t("form.displayOrder")}<input {...invalidProps("order")} className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder aria-[invalid]:border-danger" min={0} onChange={(event) => { setOrder(Number(event.target.value)); clearError("order"); }} placeholder="0" required step={1} type="number" value={order} />{fieldError("order")}</label>
            <div className="text-sm font-semibold text-ink">
              {t("form.published")}
              <div className="mt-2">
                <AdminSelect formatOption={(option) => t(`publishStates.${option}`)} label={t("form.published")} onChange={(value) => setPublished(value === "published")} options={[...publishStates]} value={published ? "published" : "draft"} />
              </div>
            </div>
          </div>
          <button className="mt-5 h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} type="submit">{saving ? tCommon("saving") : tCommon("save")}</button>
          <p className="mt-3 text-xs text-ink-muted">{tCommon("saveNotice")}</p>
        </form>
      </section>
      <DeleteConfirmDialog onCancel={() => setPendingDelete(null)} onConfirm={() => pendingDelete && void handleDelete(pendingDelete)} title={pendingDelete?.title ?? null} />
    </>
  );
}

function sortHighlights(highlights: AdminHighlight[]) {
  return [...highlights].sort((a, b) => a.order - b.order);
}
