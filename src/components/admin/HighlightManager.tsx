"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { AdminTable } from "@/components/admin/AdminTable";
import { highlightTypeLabelKeys, type AdminHighlight } from "@/lib/admin";
import { useAdminApi } from "@/components/auth/FoundationProvider";

const highlightColumns = [
  { id: "type", widthClass: "w-[22%]" },
  { id: "title", widthClass: "w-[32%]" },
  { id: "order", widthClass: "w-[12%]" },
  { id: "link", widthClass: "w-[18%]" },
  { id: "action", widthClass: "w-[16%]" },
];

const highlightTypes: AdminHighlight["type"][] = ["Milestone", "Featured bounty", "Partnership"];

type HighlightManagerProps = {
  highlights: AdminHighlight[];
};

export function HighlightManager({ highlights }: HighlightManagerProps) {
  const api = useAdminApi();
  const t = useTranslations("admin.hallOfFame.highlights");
  const tCommon = useTranslations("admin.common");
  const typeLabel = (value: string) => t(`types.${highlightTypeLabelKeys[value as AdminHighlight["type"]]}`);
  const [records, setRecords] = useState(() => sortHighlights(highlights));
  const [mode, setMode] = useState<"create" | string>("create");
  const [type, setType] = useState<AdminHighlight["type"]>("Milestone");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [order, setOrder] = useState(0);
  const formRef = useRef<HTMLElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getAdminHighlights().then((items) => setRecords(sortHighlights(items))).catch(() => pushAdminToast({ variant: "danger", title: t("toast.loadFailedTitle"), description: t("toast.loadFailedDescription") }));
  }, [api, t]);

  const isEditing = mode !== "create";

  function resetForm() {
    setMode("create");
    setType("Milestone");
    setTitle("");
    setDescription("");
    setImage(null);
    setImageFile(null);
    setLink("");
    setOrder(0);
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
    setImageFile(null);
    setLink(highlight.link ?? "");
    setOrder(highlight.order);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    setImageFile(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const uploadedImage = imageFile ? (await api.uploadAdminMedia(imageFile)).url : image;
      const record: AdminHighlight = {
        id: isEditing ? mode : `highlight-${Date.now()}`,
        type,
        title,
        description,
        image: uploadedImage,
        order,
        published: true,
        ...(link ? { link } : {}),
      };
      await api.saveAdminHighlight(record, !isEditing);
      setRecords(sortHighlights(await api.getAdminHighlights()));
      pushAdminToast({ variant: "success", title: isEditing ? t("toast.updatedTitle") : t("toast.addedTitle"), description: tCommon("savedDescription", { title }) });
      resetForm();
    } catch {
      pushAdminToast({ variant: "danger", title: tCommon("saveFailed"), description: t("toast.saveFailedDescription") });
    }
  }

  async function handleDelete(highlight: AdminHighlight) {
    if (!window.confirm(tCommon("deleteConfirm", { title: highlight.title }))) return;
    try {
      await api.deleteAdminHighlight(highlight.id);
      setRecords((current) => current.filter((item) => item.id !== highlight.id));
      pushAdminToast({ variant: "success", title: t("toast.deletedTitle"), description: highlight.title });
    } catch {
      pushAdminToast({ variant: "danger", title: tCommon("deleteFailed"), description: t("toast.deleteFailedDescription") });
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
          <AdminTable columns={highlightColumns.map((column) => ({ ...column, label: t(`columns.${column.id}`) }))} minWidthClass="min-w-[760px]">
            {records.map((highlight) => (
              <tr key={highlight.id} className="border-t border-border">
                <td className="px-5 py-4 text-sm text-ink-secondary">{typeLabel(highlight.type)}</td>
                <td className="px-5 py-4 text-sm font-semibold text-ink">{highlight.title}</td>
                <td className="px-5 py-4 text-sm text-ink-secondary">{highlight.order}</td>
                <td className="px-5 py-4 text-sm text-ink-secondary">{highlight.link ?? "–"}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-2"><button className="h-11 rounded-control border border-primary-outline bg-surface px-3 text-sm font-semibold text-primary-strong" onClick={() => handleEdit(highlight)} type="button">{tCommon("edit")}</button><button className="h-11 rounded-control border border-danger px-3 text-sm font-semibold text-danger" onClick={() => handleDelete(highlight)} type="button">{tCommon("delete")}</button></div>
                </td>
              </tr>
            ))}
          </AdminTable>
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-5 shadow-card" ref={formRef}>
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{isEditing ? t("form.eyebrowEdit") : t("form.eyebrowCreate")}</p>
        <h2 className="font-display text-2xl tracking-[-0.24px] text-ink">{isEditing ? t("form.titleEdit") : t("form.titleCreate")}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="text-sm font-semibold text-ink">
              {t("form.type")}
              <div className="mt-2">
                <AdminSelect formatOption={typeLabel} label={t("form.type")} onChange={(value) => setType(value as AdminHighlight["type"])} options={highlightTypes} value={type} />
              </div>
            </div>
            <label className="text-sm font-semibold text-ink">{t("form.title")}<input className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" onChange={(event) => setTitle(event.target.value)} placeholder={t("form.titlePlaceholder")} value={title} /></label>
            <label className="text-sm font-semibold text-ink md:col-span-2">{t("form.description")}<textarea className="mt-2 min-h-24 w-full rounded-control border border-border px-4 py-3 text-sm font-normal text-ink-secondary" onChange={(event) => setDescription(event.target.value)} required value={description} /></label>
            <div className="text-sm font-semibold text-ink">{t("form.image")}
              <button className="mt-2 flex h-[46px] w-full items-center rounded-control border border-border px-4 text-left text-sm font-normal text-ink-placeholder hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => imageInputRef.current?.click()} type="button">{image ?? t("form.uploadImage")}</button>
              <input accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleImageChange} ref={imageInputRef} type="file" />
              <span className="mt-2 block text-xs font-normal text-ink-muted">{imageFile?.name ?? image ?? tCommon("fileHint")}</span>
            </div>
            <label className="text-sm font-semibold text-ink">{t("form.link")} <span className="font-normal text-ink-muted">{t("form.optional")}</span><input className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" onChange={(event) => setLink(event.target.value)} placeholder="https://" value={link} /></label>
            <label className="text-sm font-semibold text-ink">{t("form.displayOrder")}<input className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" onChange={(event) => setOrder(Number(event.target.value))} placeholder="0" type="number" value={order} /></label>
          </div>
          <button className="mt-5 h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" type="submit">{tCommon("save")}</button>
          <p className="mt-3 text-xs text-ink-muted">{tCommon("saveNotice")}</p>
        </form>
      </section>
    </>
  );
}

function sortHighlights(highlights: AdminHighlight[]) {
  return [...highlights].sort((a, b) => a.order - b.order);
}
