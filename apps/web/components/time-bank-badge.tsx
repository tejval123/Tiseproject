"use client";

interface Props {
  minutes: number;
}

export function TimeBankBadge({ minutes }: Props) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
      minutes > 0
        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
        : "bg-neutral-800 border-neutral-700 text-neutral-500"
    }`}>
      <span className="text-base leading-none">⏱</span>
      <span>Time Bank: {minutes > 0 ? `${minutes} min` : "empty"}</span>
    </div>
  );
}
