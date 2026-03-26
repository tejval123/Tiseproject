"use client";

interface Props {
  minutes: number;
  showLabel?: boolean;
}

export function TimeBankBadge({ minutes, showLabel = true }: Props) {
  const active = minutes > 0;

  return (
    <div
      className={`animate-float flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 ${
        active
          ? "bg-[var(--emerald-bg)] border-[var(--emerald-border)] text-[var(--emerald)]"
          : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]"
      }`}
    >
      <span className="text-sm leading-none">⏱</span>
      {showLabel && <span>Time Bank:</span>}
      <span className="mono font-semibold">
        {active ? `${minutes}m` : "empty"}
      </span>
    </div>
  );
}
