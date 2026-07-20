import Image from "next/image";

type RewardPillProps = {
  reward: {
    amount: number;
    currency: "INJ" | "USDC";
  };
};

export function RewardPill({ reward }: RewardPillProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-control border border-primary-soft-border bg-primary-soft px-[13px] py-1.5">
      {reward.currency === "INJ" ? (
        <Image src="/figma/injective-token.svg" width={14} height={14} alt="" />
      ) : (
        <span className="text-xs font-bold text-primary">$</span>
      )}
      <span className="font-display text-sm font-bold text-ink">
        {reward.amount} {reward.currency}
      </span>
    </span>
  );
}
