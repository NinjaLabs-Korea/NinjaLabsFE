import Image from "next/image";

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

export function RewardPill({ reward, variant = "pill" }: RewardPillProps) {
  if (variant === "icon") {
    return <TokenIcon currency={reward.currency} />;
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-control border border-primary-soft-border bg-primary-soft px-[13px] py-1.5">
      <TokenIcon currency={reward.currency} />
      <span className="font-display text-sm font-bold text-ink">
        {reward.amount} {reward.currency}
      </span>
    </span>
  );
}
