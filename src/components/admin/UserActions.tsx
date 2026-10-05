"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";

type MemberRole = "Core" | "Dev" | "Design" | "Ops";

type UserActionsProps = {
  user: {
    slug: string;
    nickname: string;
    isMember: boolean;
    memberRole: MemberRole | null;
    memberDisplayOrder: number | null;
  };
  onAssign: (role: MemberRole, displayOrder: number | null) => void;
  onRemove: () => void;
};

const roles: MemberRole[] = ["Core", "Dev", "Design", "Ops"];
const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function UserActions({ user, onAssign, onRemove }: UserActionsProps) {
  const t = useTranslations("admin.users");
  const tCommon = useTranslations("admin.common");
  const [assignOpen, setAssignOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [role, setRole] = useState<MemberRole>(user.memberRole ?? "Core");
  const [displayOrder, setDisplayOrder] = useState(String(user.memberDisplayOrder ?? 1));
  const assignTitleId = `assign-member-role-${user.slug}`;

  function handleRemove() {
    setRemoveOpen(false);
    onRemove();
  }

  function handleAssign() {
    setAssignOpen(false);
    const parsedOrder = Number.parseInt(displayOrder, 10);
    onAssign(role, Number.isInteger(parsedOrder) && parsedOrder >= 1 ? parsedOrder : null);
  }

  return (
    <>
      <button
        className={`rounded-control border border-primary-outline px-4 py-2 text-sm font-semibold text-primary-strong ${focusClass}`}
        onClick={() => {
          if (user.isMember) {
            setRemoveOpen(true);
            return;
          }

          setRole(user.memberRole ?? "Core");
          setAssignOpen(true);
        }}
        type="button"
      >
        {user.isMember ? t("actions.remove") : t("actions.assign")}
      </button>

      <ConfirmDialog
        calloutText={t("actions.removeCallout")}
        confirmLabel={t("actions.removeConfirm")}
        description={t.rich("actions.removeDescription", { nickname: user.nickname, b: (chunks) => <b>{chunks}</b> })}
        destructive
        eyebrow={t("actions.removeEyebrow")}
        onCancel={() => setRemoveOpen(false)}
        onConfirm={handleRemove}
        open={removeOpen}
        title={t("actions.removeTitle", { nickname: user.nickname })}
      />

      <Modal labelledBy={assignTitleId} onClose={() => setAssignOpen(false)} open={assignOpen}>
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("actions.roleEyebrow")}</p>
        <h2 className="mt-2 font-display text-2xl -tracking-[0.24px] text-ink" id={assignTitleId}>{t("actions.assignTitle")}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t.rich("actions.assignDescription", { nickname: user.nickname, b: (chunks) => <b>{chunks}</b> })}</p>
        <div className="mt-4 flex flex-wrap gap-2" aria-label={t("actions.roleGroupLabel")}>
          {roles.map((item) => (
            <button
              aria-pressed={role === item}
              className={`h-6 rounded-full px-2.5 text-xs font-semibold ${role === item ? "bg-primary text-primary-soft" : "bg-primary-soft text-primary-strong"} ${focusClass}`}
              key={item}
              onClick={() => setRole(item)}
              type="button"
            >
              {t(`roles.${item}`)}
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm font-semibold text-ink" htmlFor={`display-order-${user.slug}`}>{t("actions.displayOrder")}</label>
        <input
          className={`mt-2 h-[46px] w-[200px] rounded-control border border-border px-[17px] text-sm text-ink ${focusClass}`}
          id={`display-order-${user.slug}`}
          onChange={(event) => setDisplayOrder(event.target.value)}
          type="number"
          value={displayOrder}
        />
        <div className="mt-6 flex justify-end gap-3">
          <button className={`rounded-control border border-primary-outline px-5 py-3 text-sm leading-[21px] font-semibold text-primary-strong ${focusClass}`} onClick={() => setAssignOpen(false)} type="button">{tCommon("cancel")}</button>
          <button className={`rounded-control bg-primary px-5 py-3 text-sm leading-[21px] font-semibold text-on-inverse ${focusClass}`} onClick={handleAssign} type="button">{tCommon("confirm")}</button>
        </div>
      </Modal>
    </>
  );
}
