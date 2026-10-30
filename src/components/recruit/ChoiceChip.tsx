"use client";

import { Badge } from "@/components/ui/Badge";

/**
 * One option of a radio group or a multi-select: a native input (keyboard, screen readers, form semantics) visually
 * replaced by the same pill the signup tag picker uses (`Badge` selected / primary-soft). The 40px touch height applies on phones.
 */
export function ChoiceChip({
  type,
  name,
  value,
  checked,
  label,
  onChange,
  describedBy,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  label: string;
  onChange: () => void;
  describedBy?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer rounded-full has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary max-sm:min-h-11 max-sm:items-center">
      <input
        aria-describedby={describedBy}
        checked={checked}
        className="sr-only"
        name={name}
        onChange={onChange}
        type={type}
        value={value}
      />
      <Badge variant={checked ? "selected" : "primary-soft"}>{label}</Badge>
    </label>
  );
}
