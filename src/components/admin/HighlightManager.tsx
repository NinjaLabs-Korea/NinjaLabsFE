"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { AdminTable } from "@/components/admin/AdminTable";
import type { AdminHighlight } from "@/lib/admin";
import { useFoundationApiClient, useFoundationMode } from "@/components/auth/FoundationProvider";

const highlightColumns = [
  { id: "type", label: "Type", widthClass: "w-[22%]" },
  { id: "title", label: "Title", widthClass: "w-[32%]" },
  { id: "order", label: "Order", widthClass: "w-[12%]" },
  { id: "link", label: "Link", widthClass: "w-[18%]" },
  { id: "action", label: "Action", widthClass: "w-[16%]" },
];

const highlightTypes: AdminHighlight["type"][] = ["Milestone", "Featured bounty", "Partnership"];

type HighlightManagerProps = {
  highlights: AdminHighlight[];
};

export function HighlightManager({ highlights }: HighlightManagerProps) {
  const api = useFoundationApiClient();
  const foundationMode = useFoundationMode();
  const [records, setRecords] = useState(() => sortHighlights(highlights));
  const [mode, setMode] = useState<"create" | string>("create");
  const [type, setType] = useState<AdminHighlight["type"]>("Milestone");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [order, setOrder] = useState(0);
  const formRef = useRef<HTMLElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (foundationMode !== "api") return;
    api.getAdminHighlights().then((items) => setRecords(sortHighlights(items))).catch(() => pushAdminToast({ variant: "danger", title: "Highlights unavailable", description: "Could not load highlights." }));
  }, [api, foundationMode]);

  const isEditing = mode !== "create";

  function resetForm() {
    setMode("create");
    setType("Milestone");
    setTitle("");
    setDescription("");
    setImage(null);
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
    setLink(highlight.link ?? "");
    setOrder(highlight.order);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    setImage(event.target.files?.[0]?.name ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const record: AdminHighlight = {
      id: isEditing ? mode : `highlight-${Date.now()}`,
      type,
      title,
      description,
      image,
      order,
      published: true,
      ...(link ? { link } : {}),
    };

    try {
      await api.saveAdminHighlight(record, !isEditing);
      setRecords(sortHighlights(await api.getAdminHighlights()));
      pushAdminToast({ variant: "success", title: isEditing ? "Highlight updated" : "Highlight added", description: `"${title}" was saved.` });
      resetForm();
    } catch {
      pushAdminToast({ variant: "danger", title: "Save failed", description: "The highlight was not saved." });
    }
  }

  async function handleDelete(highlight: AdminHighlight) {
    if (!window.confirm(`Delete ${highlight.title}?`)) return;
    try {
      await api.deleteAdminHighlight(highlight.id);
      setRecords((current) => current.filter((item) => item.id !== highlight.id));
      pushAdminToast({ variant: "success", title: "Highlight deleted", description: highlight.title });
    } catch {
      pushAdminToast({ variant: "danger", title: "Delete failed", description: "The highlight was not deleted." });
    }
  }

  return (
    <>
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">Manual</p>
            <h2 className="font-display text-2xl tracking-[-0.24px] text-ink">Highlight curation</h2>
          </div>
          <button className="h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={handleAdd} type="button">+ Add item</button>
        </div>
        <div className="mt-6">
          <AdminTable columns={highlightColumns} minWidthClass="min-w-[760px]">
            {records.map((highlight) => (
              <tr key={highlight.id} className="border-t border-border">
                <td className="px-5 py-4 text-sm text-ink-secondary">{highlight.type}</td>
                <td className="px-5 py-4 text-sm font-semibold text-ink">{highlight.title}</td>
                <td className="px-5 py-4 text-sm text-ink-secondary">{highlight.order}</td>
                <td className="px-5 py-4 text-sm text-ink-secondary">{highlight.link ?? "–"}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-2"><button className="h-11 rounded-control border border-primary-outline bg-surface px-3 text-sm font-semibold text-primary-strong" onClick={() => handleEdit(highlight)} type="button">Edit</button><button className="h-11 rounded-control border border-danger px-3 text-sm font-semibold text-danger" onClick={() => handleDelete(highlight)} type="button">Delete</button></div>
                </td>
              </tr>
            ))}
          </AdminTable>
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-5 shadow-card" ref={formRef}>
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{isEditing ? "Edit" : "Create"}</p>
        <h2 className="font-display text-2xl tracking-[-0.24px] text-ink">{isEditing ? "Edit highlight" : "Add highlight"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="text-sm font-semibold text-ink">
              Type
              <div className="mt-2">
                <AdminSelect label="Type" onChange={(value) => setType(value as AdminHighlight["type"])} options={highlightTypes} value={type} />
              </div>
            </div>
            <label className="text-sm font-semibold text-ink">Title<input className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" onChange={(event) => setTitle(event.target.value)} placeholder="Highlight title" value={title} /></label>
            <label className="text-sm font-semibold text-ink md:col-span-2">Description<textarea className="mt-2 min-h-24 w-full rounded-control border border-border px-4 py-3 text-sm font-normal text-ink-secondary" onChange={(event) => setDescription(event.target.value)} required value={description} /></label>
            <div className="text-sm font-semibold text-ink">Image
              <button className="mt-2 flex h-[46px] w-full items-center rounded-control border border-border px-4 text-left text-sm font-normal text-ink-placeholder hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => imageInputRef.current?.click()} type="button">{image ?? "Upload image"}</button>
              <input className="sr-only" onChange={handleImageChange} ref={imageInputRef} type="file" />
            </div>
            <label className="text-sm font-semibold text-ink">Link <span className="font-normal text-ink-muted">(optional)</span><input className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" onChange={(event) => setLink(event.target.value)} placeholder="https://" value={link} /></label>
            <label className="text-sm font-semibold text-ink">Display order<input className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" onChange={(event) => setOrder(Number(event.target.value))} placeholder="0" type="number" value={order} /></label>
          </div>
          <button className="mt-5 h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" type="submit">Save</button>
          <p className="mt-3 text-xs text-ink-muted">Changes are saved to the platform immediately.</p>
        </form>
      </section>
    </>
  );
}

function sortHighlights(highlights: AdminHighlight[]) {
  return [...highlights].sort((a, b) => a.order - b.order);
}
