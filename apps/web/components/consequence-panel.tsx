"use client";

import type { ConsequenceResult } from "@repo/core";

interface Props {
  result: ConsequenceResult;
  onAccept: () => void;
  onSoftDeadline: () => void;
  onUseSuggestedDate: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConsequencePanel({ result, onAccept, onSoftDeadline, onUseSuggestedDate, onCancel, loading }: Props) {
  const {
    tasksSlipping,
    tasksOnTime,
    deepWorkAffected,
    bufferCost,
    timeBankCanAbsorb,
    suggestedDate,
    consecutiveOverloadDays,
    adjustedEffort,
  } = result;

  const isCritical = consecutiveOverloadDays >= 3;

  return (
    <div className="animate-scale-in bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div
        className={`px-5 py-4 border-b border-[var(--border-subtle)] ${
          isCritical ? "bg-[var(--red-bg)]" : "bg-[var(--amber-bg)]"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{isCritical ? "⚠️" : "👁"}</span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {isCritical ? "Critical overload ahead" : "Here's what changes"}
            </h3>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {isCritical
                ? `Your schedule is overloaded for ${consecutiveOverloadDays}+ consecutive days.`
                : `${adjustedEffort}m adjusted effort — review the impact, then decide.`}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Tasks staying on time */}
        {tasksOnTime.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2">
              Stays on time
            </p>
            <div className="space-y-1">
              {tasksOnTime.slice(0, 3).map((t) => (
                <div key={t.taskId} className="flex items-center gap-2 text-sm">
                  <span className="text-[var(--emerald)] text-xs">✓</span>
                  <span className="text-[var(--text-secondary)] truncate">{t.title}</span>
                </div>
              ))}
              {tasksOnTime.length > 3 && (
                <p className="text-xs text-[var(--text-muted)]">+{tasksOnTime.length - 3} more</p>
              )}
            </div>
          </div>
        )}

        {/* Tasks slipping */}
        {tasksSlipping.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2">
              Will slip
            </p>
            <div className="space-y-1.5">
              {tasksSlipping.map((t) => (
                <div
                  key={t.taskId}
                  className="flex items-center justify-between text-sm px-3 py-2 rounded-xl bg-[var(--amber-bg)] border border-[var(--amber-border)]"
                >
                  <span className="text-[var(--text-secondary)] truncate">{t.title}</span>
                  <span className="mono text-xs font-semibold text-[var(--amber)] shrink-0 ml-2">
                    +{t.slipDays}d
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {deepWorkAffected && (
            <span className="text-[11px] font-medium bg-[var(--violet-bg)] border border-[var(--violet-border)] text-[var(--violet)] px-2.5 py-1 rounded-full">
              Deep work affected
            </span>
          )}
          {timeBankCanAbsorb && (
            <span className="text-[11px] font-medium bg-[var(--emerald-bg)] border border-[var(--emerald-border)] text-[var(--emerald)] px-2.5 py-1 rounded-full">
              Time Bank can cover this
            </span>
          )}
          {bufferCost > 0 && (
            <span className="text-[11px] font-medium bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] px-2.5 py-1 rounded-full">
              Uses {bufferCost}m buffer
            </span>
          )}
          {suggestedDate && (
            <span className="text-[11px] font-medium bg-[var(--accent-indigo-bg)] border border-[var(--accent-indigo-border)] text-[var(--accent-indigo)] px-2.5 py-1 rounded-full">
              Fits by {suggestedDate}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-[var(--border-subtle)] space-y-2">
        <button
          onClick={onAccept}
          disabled={loading}
          className="w-full bg-gradient-to-r from-[var(--accent-indigo-solid-hover)] to-[var(--accent-indigo-solid)] hover:from-[#4338ca] hover:to-[var(--accent-indigo-solid-hover)] disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-all duration-200"
        >
          {loading ? "Saving..." : "Accept the trade-off"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          {suggestedDate && (
            <button
              onClick={onUseSuggestedDate}
              disabled={loading}
              className="bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-medium py-2.5 rounded-xl transition-colors"
            >
              Use {suggestedDate}
            </button>
          )}
          <button
            onClick={onSoftDeadline}
            disabled={loading}
            className="bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-medium py-2.5 rounded-xl transition-colors"
          >
            Mark flexible
          </button>
        </div>
        <button
          onClick={onCancel}
          className="w-full text-[var(--text-muted)] hover:text-[var(--text-tertiary)] text-xs font-medium py-2 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
