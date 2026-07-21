"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { AdminTable } from "@/components/admin/AdminTable";
import type { AdminHighlight } from "@/lib/admin";

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
  const [records, setRecords] = useState(() => sortHighlights(highlights));
  const [mode, setMode] = useState<"create" | string>("create");
  const [type, setType] = useState<AdminHighlight["type"]>("Milestone");
  const [title, setTitle] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [order, setOrder] = useState(0);
  const formRef = useRef<HTMLElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const isEditing = mode !== "create";

  function resetForm() {
    setMode("create");
    setType("Milestone");
    setTitle("");
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
    setImage(highlight.image);
    setLink(highlight.link ?? "");
    setOrder(highlight.order);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    setImage(event.target.files?.[0]?.name ?? null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const record: AdminHighlight = {
      id: isEditing ? mode : `highlight-${Date.now()}`,
      type,
      title,
      image,
      order,
      ...(link ? { link } : {}),
    };

    setRecords((current) => sortHighlights(isEditing ? current.map((item) => (item.id === mode ? record : item)) : [...current, record]));
    pushAdminToast({ variant: "success", title: isEditing ? "Highlight updated" : "Highlight added", description: `"${title}" — session preview, resets on reload.` });
    resetForm();
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
                  <button className="h-11 rounded-control border border-primary-outline bg-surface px-4 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => handleEdit(highlight)} type="button">Edit</button>
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
            <div className="text-sm font-semibold text-ink">Image
              <button className="mt-2 flex h-[46px] w-full items-center rounded-control border border-border px-4 text-left text-sm font-normal text-ink-placeholder hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => imageInputRef.current?.click()} type="button">{image ?? "Upload image"}</button>
              <input className="sr-only" onChange={handleImageChange} ref={imageInputRef} type="file" />
            </div>
            <label className="text-sm font-semibold text-ink">Link <span className="font-normal text-ink-muted">(optional)</span><input className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" onChange={(event) => setLink(event.target.value)} placeholder="https://" value={link} /></label>
            <label className="text-sm font-semibold text-ink">Display order<input className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" onChange={(event) => setOrder(Number(event.target.value))} placeholder="0" type="number" value={order} /></label>
          </div>
          <button className="mt-5 h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" type="submit">Save</button>
          <p className="mt-3 text-xs text-ink-muted">Session preview — changes are local to this tab and reset on reload.</p>
        </form>
      </section>
    </>
  );
}

function sortHighlights(highlights: AdminHighlight[]) {
  return [...highlights].sort((a, b) => a.order - b.order);
}
