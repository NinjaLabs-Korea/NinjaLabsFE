import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";

type RewardPillProps = {
  reward: {
    amount: number;
    currency: "INJ" | "USDC";
  };
  /** `icon` renders only the token glyph (used inside composed pills such as "Sponsor pays: 500 INJ"). */
  variant?: "pill" | "icon";
};

function TokenIcon({ currency }: { currency: RewardPillProps["reward"]["currency"] }) {
  return currency === "INJ" ? (
    <Image src="/figma/injective-token.svg" width={14} height={14} alt="" />
  ) : (
    <span className="text-xs font-bold text-primary">$</span>
  );
}

/** A bounty with no reward row is mapped to `{ amount: 0 }`; it has no token yet, so it reads "Reward TBD" instead of "0 INJ". */
export function isRewardUnset(reward: RewardPillProps["reward"]): boolean {
  return !(reward.amount > 0);
}

export function RewardPill({ reward, variant = "pill" }: RewardPillProps) {
  const format = useFormatter();
  const t = useTranslations("common.reward");
  const unset = isRewardUnset(reward);
  if (variant === "icon") {
    return unset ? null : <TokenIcon currency={reward.currency} />;
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-control border border-primary-soft-border bg-primary-soft px-[13px] py-1.5">
      {unset ? null : <TokenIcon currency={reward.currency} />}
      <span className="font-display text-sm font-bold text-ink">
        {unset ? t("tbd") : `${format.number(reward.amount, { maximumFractionDigits: 6 })} ${reward.currency}`}
      </span>
    </span>
  );
}
