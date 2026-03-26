"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

interface Task {
  id: string;
  title: string;
  estimated_minutes: number;
}

interface Props {
  taskId: string;
  task: Task;
  onClose: () => void;
  onLogged: () => void;
}

export function LogSessionModal({ taskId, task, onClose, onLogged }: Props) {
  const [actualHours, setActualHours] = useState(0);
  const [actualMins, setActualMins] = useState(30);
  const [loading, setLoading] = useState(false);
  const [bankMessage, setBankMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actualTotal = actualHours * 60 + actualMins;
  const diff = actualTotal - task.estimated_minutes;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Not authenticated"); setLoading(false); return; }

    const res = await fetch("/api/time-sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        taskId,
        estimatedMinutes: task.estimated_minutes,
        actualMinutes: actualTotal,
      }),
    });

    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed to log session"); setLoading(false); return; }

    setBankMessage(data.bankMessage);
    setTimeout(() => onLogged(), 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="animate-slide-up w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Log time</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate max-w-xs">{task.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {bankMessage ? (
          <div className="px-5 py-10 text-center animate-scale-in">
            <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-[var(--emerald-bg)] border border-[var(--emerald-border)] flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--emerald)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--emerald)]">{bankMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            {/* Estimate reference */}
            <div className="bg-[var(--bg-elevated)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-tertiary)] flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              Estimated: <span className="mono font-medium text-[var(--text-secondary)]">{task.estimated_minutes}m</span>
            </div>

            {/* Actual time */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1.5 tracking-wide">
                Actual time spent
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    min={0}
                    max={16}
                    value={actualHours}
                    onChange={(e) => setActualHours(Number(e.target.value))}
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] text-center focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1 text-center">hours</p>
                </div>
                <div className="flex-1">
                  <select
                    value={actualMins}
                    onChange={(e) => setActualMins(Number(e.target.value))}
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] text-center focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1 text-center">minutes</p>
                </div>
              </div>
            </div>

            {/* Delta indicator */}
            {actualTotal > 0 && (
              <div
                className={`text-xs px-3.5 py-2.5 rounded-xl border flex items-center gap-2 ${
                  diff > 0
                    ? "bg-[var(--amber-bg)] border-[var(--amber-border)] text-[var(--amber)]"
                    : diff < 0
                    ? "bg-[var(--emerald-bg)] border-[var(--emerald-border)] text-[var(--emerald)]"
                    : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-tertiary)]"
                }`}
              >
                {diff > 0 ? (
                  <>⚡ <span className="mono font-medium">{diff}m</span> over — Time Bank will absorb</>
                ) : diff < 0 ? (
                  <>✨ <span className="mono font-medium">{Math.abs(diff)}m</span> under — earning Time Bank</>
                ) : (
                  "Right on estimate"
                )}
              </div>
            )}

            {error && (
              <p className="text-xs text-[var(--red)] bg-[var(--red-bg)] border border-[var(--red-border)] rounded-xl px-3.5 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || actualTotal < 1}
              className="w-full bg-gradient-to-r from-[var(--accent-indigo-solid-hover)] to-[var(--accent-indigo-solid)] disabled:opacity-40 text-white text-sm font-semibold py-3 rounded-xl transition-all duration-200"
            >
              {loading ? "Logging..." : "Log session"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
