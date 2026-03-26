"use client";

import { useState } from "react";
import type { RebalancePlan } from "@repo/core";

interface Props {
  plan: RebalancePlan;
  onAccept: (planId: string) => Promise<void>;
  onDismiss: () => void;
}

function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const LEVEL_CONFIG: Record<number, { label: string; color: string; bg: string; border: string }> = {
  1: { label: "Local Repair", color: "var(--text-secondary)", bg: "var(--bg-elevated)", border: "var(--border-subtle)" },
  2: { label: "Day Rebalance", color: "var(--amber)", bg: "var(--amber-bg)", border: "var(--amber-border)" },
  3: { label: "Horizon Rebalance", color: "var(--red)", bg: "var(--red-bg)", border: "var(--red-border)" },
};

export function RebalancePanel({ plan, onAccept, onDismiss }: Props) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const level = LEVEL_CONFIG[plan.slipLevel] ?? LEVEL_CONFIG[2]!;

  async function handleAccept() {
    setLoading(true);
    await onAccept(plan.id);
    setAccepted(true);
    setLoading(false);
  }

  const movableMoves = plan.moves.filter((m) => m.action === "move");
  const pinnedMoves = plan.moves.filter((m) => m.action === "pin_respected");

  return (
    <div className="space-y-4">
      {/* Trigger banner */}
      <div
        className="animate-fade-up rounded-2xl p-4 flex gap-3 border"
        style={{ background: level.bg, borderColor: level.border }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={level.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <path d="M12 9v4m0 4h.01" />
        </svg>
        <div>
          <p className="text-[13px] font-semibold" style={{ color: level.color }}>
            Schedule rebalance needed
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Level {plan.slipLevel} · {level.label} · {new Date(plan.triggeredAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
      </div>

      {/* Moves card */}
      {movableMoves.length > 0 && (
        <div className="animate-fade-up stagger-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">What TISE wants to change</h3>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {movableMoves.length} task{movableMoves.length > 1 ? "s" : ""} will be moved to protect deadlines.
            </p>
          </div>

          <div className="px-5 py-3">
            {movableMoves.map((move, i) => (
              <div
                key={move.blockId}
                className={`py-4 ${i < movableMoves.length - 1 ? "border-b border-[var(--border-subtle)]" : ""}`}
              >
                <p className="text-[13px] font-medium text-[var(--text-primary)] mb-3">
                  {move.taskTitle}
                </p>

                {/* Before → After */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 px-3 py-2 rounded-xl bg-[var(--red-bg)] border border-[var(--red-border)]">
                    <p className="text-[10px] text-[var(--text-muted)] mb-1">Before</p>
                    <p className="mono text-xs font-medium text-[var(--red)]">
                      {formatDate(move.before.date)} · {formatMinute(move.before.startMinute)}
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M5 12h14m-7-7 7 7-7 7" />
                  </svg>
                  <div className="flex-1 px-3 py-2 rounded-xl bg-[var(--emerald-bg)] border border-[var(--emerald-border)]">
                    <p className="text-[10px] text-[var(--text-muted)] mb-1">After</p>
                    <p className="mono text-xs font-medium text-[var(--emerald)]">
                      {formatDate(move.after.date)} · {formatMinute(move.after.startMinute)}
                    </p>
                  </div>
                </div>

                {/* Reason */}
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg-elevated)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-indigo)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                    <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" />
                  </svg>
                  <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">{move.reason}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Protected tasks */}
          {pinnedMoves.length > 0 && (
            <div className="px-5 py-3 border-t border-[var(--border-subtle)]">
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2">
                Protected (not moved)
              </p>
              {pinnedMoves.map((m) => (
                <div key={m.blockId} className="flex items-center gap-2 py-1.5 text-xs">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--amber)">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                  </svg>
                  <span className="text-[var(--text-secondary)]">{m.taskTitle}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {!accepted ? (
        <div className="animate-fade-up stagger-3 space-y-2">
          <button
            onClick={handleAccept}
            disabled={loading}
            className="w-full bg-gradient-to-r from-[var(--accent-indigo-solid-hover)] to-[var(--accent-indigo-solid)] disabled:opacity-50 text-white text-sm font-semibold py-3.5 rounded-2xl transition-all duration-200"
          >
            {loading ? "Applying..." : "Accept rebalance"}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onDismiss}
              className="flex-1 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-medium hover:bg-[var(--bg-elevated)] transition-colors flex items-center justify-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6.69 3L3 13" />
              </svg>
              Undo all
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-medium hover:bg-[var(--bg-elevated)] transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-scale-in bg-[var(--emerald-bg)] border border-[var(--emerald-border)] rounded-2xl p-5 text-center">
          <p className="text-sm font-semibold text-[var(--emerald)]">Schedule updated ✓</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
            {movableMoves.length} task{movableMoves.length > 1 ? "s" : ""} moved. You can undo from the activity log.
          </p>
        </div>
      )}
    </div>
  );
}
