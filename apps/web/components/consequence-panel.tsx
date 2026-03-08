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
  const { tasksSlipping, tasksOnTime, deepWorkAffected, bufferCost, timeBankCanAbsorb, suggestedDate, consecutiveOverloadDays } = result;

  const isCritical = consecutiveOverloadDays >= 3;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-4 border-b border-neutral-800 ${isCritical ? "bg-red-500/10" : "bg-amber-500/5"}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{isCritical ? "⚠️" : "👁"}</span>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {isCritical ? "Critical overload ahead" : "Here's what changes if you add this"}
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {isCritical
                ? `Your schedule is overloaded for ${consecutiveOverloadDays}+ consecutive days.`
                : "Review the impact, then decide."}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Tasks staying on time */}
        {tasksOnTime.length > 0 && (
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Stays on time</p>
            <div className="space-y-1">
              {tasksOnTime.slice(0, 3).map((t) => (
                <div key={t.taskId} className="flex items-center gap-2 text-sm">
                  <span className="text-emerald-400 text-xs">✓</span>
                  <span className="text-neutral-300 truncate">{t.title}</span>
                </div>
              ))}
              {tasksOnTime.length > 3 && (
                <p className="text-xs text-neutral-600">+{tasksOnTime.length - 3} more</p>
              )}
            </div>
          </div>
        )}

        {/* Tasks slipping */}
        {tasksSlipping.length > 0 && (
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Slips</p>
            <div className="space-y-1">
              {tasksSlipping.map((t) => (
                <div key={t.taskId} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-300 truncate">{t.title}</span>
                  <span className="text-amber-400 text-xs shrink-0 ml-2">+{t.slipDays}d</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {deepWorkAffected && (
            <span className="text-xs bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2.5 py-1 rounded-full">
              Deep work affected
            </span>
          )}
          {timeBankCanAbsorb && (
            <span className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full">
              Time Bank can cover this
            </span>
          )}
          {bufferCost > 0 && (
            <span className="text-xs bg-neutral-800 border border-neutral-700 text-neutral-400 px-2.5 py-1 rounded-full">
              Uses {bufferCost}m buffer
            </span>
          )}
          {suggestedDate && (
            <span className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-full">
              Fits by {suggestedDate}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-neutral-800 space-y-2">
        <button
          onClick={onAccept}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          Accept the trade-off
        </button>
        <div className="grid grid-cols-2 gap-2">
          {suggestedDate && (
            <button
              onClick={onUseSuggestedDate}
              disabled={loading}
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium py-2 rounded-lg transition-colors"
            >
              Use {suggestedDate}
            </button>
          )}
          <button
            onClick={onSoftDeadline}
            disabled={loading}
            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium py-2 rounded-lg transition-colors"
          >
            Mark flexible
          </button>
        </div>
        <button
          onClick={onCancel}
          className="w-full text-neutral-600 hover:text-neutral-400 text-xs font-medium py-1.5 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
