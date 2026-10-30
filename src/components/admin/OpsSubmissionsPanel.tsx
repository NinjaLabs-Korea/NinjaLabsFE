"use client";

import { hasVisibleText } from "@/lib/visible-text";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminLongText, AdminTable, adminLongTextCell } from "@/components/admin/AdminTable";
import type { OpsDateFormatter, OpsRunner } from "@/components/admin/BountyOperations";
import { OpsActorCell } from "@/components/admin/OpsActorCell";
import { OpsFormModal } from "@/components/admin/OpsFormModal";
import { opsButton, opsCell, opsDangerButton, opsPanel, opsPanelEyebrow, opsPanelTitle, opsPrimaryButton, opsShort, opsTextarea } from "@/components/admin/ops-ui";
import { useAdminApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { submissionCommentRequired, submissionDecisionsFor, type AdminOperations, type OpsSubmission, type SubmissionDecision } from "@/lib/admin-operations";
import { OPS_NOTE_MAX } from "@/lib/input-limits";
import { safeHttpUrl } from "@/lib/api/codecs";

const columns = ["submitter", "work", "status", "wallet", "action"] as const;
const subVariant = (status: string) =>
  status === "APPROVED" ? "success" : status === "REJECTED" ? "danger" : status === "WITHDRAWN" ? "neutral" : status === "REVISION_REQUESTED" ? "warning" : status === "IN_REVIEW" ? "primary-soft" : "warning";
const decisionButton: Record<SubmissionDecision, string> = { START_REVIEW: opsButton, REQUEST_REVISION: opsButton, APPROVE: opsPrimaryButton, REJECT: opsDangerButton };

/**
 * Submissions: latest revision + review history, and start review / request revision / approve / reject. Every review sends the
 * revision number shown in the dialog, so a resubmission that lands meanwhile answers SUBMISSION_REVISION_CHANGED (then the list re-reads).
 */
export function OpsSubmissionsPanel({ ops, busy, run, formatDate }: { ops: AdminOperations; busy: ReadonlySet<string>; run: OpsRunner; formatDate: OpsDateFormatter }) {
  const api = useAdminApi();
  const t = useTranslations("admin.operations");
  const [target, setTarget] = useState<{ submission: OpsSubmission; decision: SubmissionDecision; revisionNo: number } | null>(null);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState(false);
  // The dialog describes the revision and status it was opened on. When a re-read shows either moved (a resubmission, another admin's decision),
  // keeping it open would resend a stale revisionNo that the BE refuses with SUBMISSION_REVISION_CHANGED every time: close it instead.
  const live = target ? ops.submissions.find((item) => item.id === target.submission.id) : undefined;
  const targetCurrent = target !== null && live !== undefined && live.currentRevisionNo === target.revisionNo && submissionDecisionsFor(live.status, ops.bounty.status).includes(target.decision);

  const submit = async () => {
    if (!target) return;
    const { submission, decision, revisionNo } = target;
    if (submissionCommentRequired(decision, submission.status) && !hasVisibleText(comment)) {
      setCommentError(true);
      return;
    }
    const ok = await run(`submission:${submission.id}`, () => api.reviewAdminSubmission(submission.id, { decision, revisionNo, comment }), {
      title: t(`toast.submission.${decision}`),
      description: submission.agentName ?? submission.nickname ?? "",
    });
    if (ok) setTarget(null);
  };

  return (
    <section aria-labelledby="ops-submissions-title" className={opsPanel}>
      <p className={opsPanelEyebrow}>{t("submissions.eyebrow")}</p>
      <h3 className={opsPanelTitle} id="ops-submissions-title">{t("submissions.title")}</h3>
      {ops.submissions.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">{t("submissions.empty")}</p>
      ) : (
        <div className="mt-4">
          <AdminTable columns={columns.map((id) => ({ id, label: t(`submissions.columns.${id}`) }))} idPrefix="ops-submissions-col" minWidthClass="min-w-[960px]">
            {ops.submissions.map((submission) => {
              const latest = submission.revisions[0];
              const work = safeHttpUrl(latest?.submissionUrl);
              const repo = safeHttpUrl(latest?.repositoryUrl);
              const decisions = submissionDecisionsFor(submission.status, ops.bounty.status);
              return (
                <tr className="border-t border-border" key={submission.id}>
                  <td className={`${opsCell} ${adminLongTextCell}`}><OpsActorCell actor={submission} /><p className="mt-1 text-xs text-ink-muted">{formatDate(submission.submittedAt)}</p></td>
                  <td className={`${opsCell} max-w-[360px] ${adminLongTextCell}`}>
                    <p className="text-xs font-semibold text-ink">{t("submissions.revision", { revision: submission.currentRevisionNo })}</p>
                    {latest ? <div className="mt-1"><AdminLongText labelledBy="ops-submissions-col-work">{latest.description}</AdminLongText></div> : null}
                    <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
                      {work ? <a className="text-primary-strong underline" href={work} rel="noreferrer" target="_blank">{t("submissions.workLink")}</a> : null}
                      {repo ? <a className="text-primary-strong underline" href={repo} rel="noreferrer" target="_blank">{t("submissions.repoLink")}</a> : null}
                      {latest?.commitSha ? <span className="font-mono font-normal text-ink-muted">{latest.commitSha}</span> : null}
                    </div>
                    {submission.reviews.length ? (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer font-semibold text-ink-secondary">{t("submissions.history", { count: submission.reviews.length })}</summary>
                        <ul className="mt-1 space-y-1">
                          {submission.reviews.map((review, index) => (
                            <li key={`${review.createdAt}-${index}`}>{t("submissions.historyItem", { decision: t.has(`submissions.decisions.${review.decision}`) ? t(`submissions.decisions.${review.decision}`) : review.decision, revision: review.revisionNo ?? "–", date: formatDate(review.createdAt) })}{review.comment ? ` - ${review.comment}` : ""}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </td>
                  <td className={opsCell}><Badge variant={subVariant(submission.status)}>{t(`submissionStatuses.${submission.status}`)}</Badge></td>
                  <td className={`${opsCell} text-xs`} title={submission.recipientWalletAddress ?? undefined}>
                    {submission.recipientWalletAddress
                      ? <span className="font-mono">{opsShort(submission.recipientWalletAddress)}</span>
                      // A missing wallet only blocks a payout: warn on an approved submission of a bounty that pays something, a dash elsewhere.
                      : submission.status === "APPROVED" && ops.rewards.length > 0
                        ? <span className="text-danger">{t("submissions.noWallet")}</span>
                        : <span className="text-ink-muted">–</span>}
                  </td>
                  <td className={opsCell}>
                    <div className="flex flex-wrap gap-2">
                      {decisions.map((decision) => (
                        <button className={decisionButton[decision]} disabled={busy.has(`submission:${submission.id}`)} key={decision} onClick={() => { setTarget({ submission, decision, revisionNo: submission.currentRevisionNo }); setComment(""); setCommentError(false); }} type="button">
                          {t(`submissions.decisions.${decision}`)}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        </div>
      )}
      <OpsFormModal
        busy={target ? busy.has(`submission:${target.submission.id}`) : false}
        description={target ? t("submissions.modalDescription", { name: target.submission.agentName ?? target.submission.nickname ?? "–", revision: target.revisionNo }) : undefined}
        eyebrow={t("submissions.eyebrow")}
        onCancel={() => setTarget(null)}
        onSubmit={() => void submit()}
        open={targetCurrent}
        submitLabel={target ? t(`submissions.decisions.${target.decision}`) : ""}
        title={target ? t(`submissions.modalTitles.${target.decision}`) : ""}
      >
        {target && targetCurrent ? (
          <label className="block text-sm font-semibold text-ink">{submissionCommentRequired(target.decision, target.submission.status) ? t("form.commentRequired") : t("form.commentOptional")}
            <textarea aria-describedby={commentError ? "ops-submission-comment-error" : undefined} aria-invalid={commentError || undefined} className={opsTextarea} maxLength={OPS_NOTE_MAX} onChange={(event) => { setComment(event.target.value); setCommentError(false); }} value={comment} />
            {commentError ? <span className="mt-1 block text-xs font-normal text-danger" id="ops-submission-comment-error" role="alert">{t("errors.REVISION_COMMENT_REQUIRED")}</span> : null}
          </label>
        ) : null}
      </OpsFormModal>
    </section>
  );
}
