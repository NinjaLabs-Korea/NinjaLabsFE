import type { ChangeEvent, ReactNode } from "react";
import { opsInput, opsTextarea } from "@/components/admin/ops-ui";

export type LangValues = { ko: string; en: string; zh: string };
type LocalizedTextFieldsProps = {
  value: LangValues;
  onChange: (lang: keyof LangValues, next: string) => void;
  labels: LangValues;
  /** Multi-line (`<textarea>`) instead of single-line fields. */
  multiline?: boolean;
  /** Message under the Korean field; its presence marks the field invalid. */
  issue?: ReactNode;
};

/** The ko (full width) / en / zh trio of one localized text (question label, help, option label). Renders into the parent's grid. */
export function LocalizedTextFields({ value, onChange, labels, multiline = false, issue }: LocalizedTextFieldsProps) {
  const field = (lang: keyof LangValues) => {
    const props = { className: multiline ? opsTextarea : opsInput, onChange: (event: ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange(lang, event.target.value), value: value[lang] };
    return multiline ? <textarea {...props} aria-invalid={lang === "ko" && issue ? true : undefined} /> : <input {...props} aria-invalid={lang === "ko" && issue ? true : undefined} />;
  };
  return (
    <>
      <label className="text-sm font-semibold text-ink md:col-span-2">{labels.ko}{field("ko")}{issue}</label>
      <label className="text-sm font-semibold text-ink">{labels.en}{field("en")}</label>
      <label className="text-sm font-semibold text-ink">{labels.zh}{field("zh")}</label>
    </>
  );
}
