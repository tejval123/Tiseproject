"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { ConsequencePanel } from "./consequence-panel";
import type { ConsequenceResult } from "@repo/core";

const TASK_TYPES = [
  { value: "standard", label: "Standard", icon: "📋" },
  { value: "deep_work", label: "Deep Work", icon: "🧠" },
  { value: "admin", label: "Admin", icon: "📎" },
  { value: "habit", label: "Habit", icon: "🔄" },
];

interface Props {
  onClose: () => void;
  onTaskAdded: () => void;
}

type Step = "form" | "computing" | "consequence" | "saving";

export function AddTaskModal({ onClose, onTaskAdded }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("standard");
  const [estimatedHours, setEstimatedHours] = useState(1);
  const [estimatedMins, setEstimatedMins] = useState(0);
  const [deadline, setDeadline] = useState("");
  const [consequence, setConsequence] = useState<ConsequenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalMinutes = estimatedHours * 60 + estimatedMins;

  async function getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? `Bearer ${session.access_token}` : null;
  }

  async function handleCheckConsequence(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !deadline || totalMinutes < 5) return;

    setError(null);
    setStep("computing");

    const auth = await getAuthHeader();
    if (!auth) { setError("Not authenticated"); setStep("form"); return; }

    const res = await fetch("/api/consequence", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({
        newTask: { type, estimatedMinutes: totalMinutes, deadlineDate: deadline },
      }),
    });

    if (!res.ok) { setError("Failed to compute consequence"); setStep("form"); return; }

    const data = await res.json();
    setConsequence(data);
    setStep("consequence");
  }

  async function commitTask(opts: { isSoftDeadline: boolean; deadlineOverride?: string }) {
    setSaving(true);
    setStep("saving");
    const auth = await getAuthHeader();
    if (!auth) return;

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({
        title,
        type,
        estimatedMinutes: totalMinutes,
        deadlineDate: opts.deadlineOverride ?? deadline,
        isSoftDeadline: opts.isSoftDeadline,
        isFixed: false,
      }),
    });

    if (res.ok) { onTaskAdded(); onClose(); }
    else { setError("Failed to save task"); setStep("consequence"); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ── Form ── */}
        {step === "form" && (
          <div className="animate-slide-up bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Add task</h2>
              <button
                onClick={onClose}
                className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCheckConsequence} className="px-5 py-4 space-y-4">
              {/* Task name */}
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1.5 tracking-wide">
                  Task name
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to get done?"
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1.5 tracking-wide">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TASK_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`py-2.5 px-3 text-xs font-medium rounded-xl border transition-all duration-150 flex items-center gap-2 ${
                        type === t.value
                          ? "border-[var(--border-focus)] bg-[var(--accent-indigo-bg)] text-[var(--accent-indigo)]"
                          : "border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-[var(--border-medium)]"
                      }`}
                    >
                      <span>{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estimated time */}
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1.5 tracking-wide">
                  Estimated time
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      min={0}
                      max={16}
                      value={estimatedHours}
                      onChange={(e) => setEstimatedHours(Number(e.target.value))}
                      className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] text-center focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                    />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1 text-center">hours</p>
                  </div>
                  <div className="flex-1">
                    <select
                      value={estimatedMins}
                      onChange={(e) => setEstimatedMins(Number(e.target.value))}
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

              {/* Deadline */}
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1.5 tracking-wide">
                  Deadline
                </label>
                <input
                  type="date"
                  required
                  value={deadline}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                />
              </div>

              {error && (
                <p className="text-xs text-[var(--red)] bg-[var(--red-bg)] border border-[var(--red-border)] rounded-xl px-3.5 py-2.5">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={totalMinutes < 5 || !deadline}
                className="w-full bg-gradient-to-r from-[var(--accent-indigo-solid-hover)] to-[var(--accent-indigo-solid)] hover:from-[#4338ca] hover:to-[var(--accent-indigo-solid-hover)] disabled:opacity-40 text-white text-sm font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                See the impact
              </button>
            </form>
          </div>
        )}

        {/* ── Computing animation ── */}
        {step === "computing" && (
          <div className="animate-scale-in bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl px-5 py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-5 rounded-2xl bg-[var(--accent-indigo-bg)] border border-[var(--accent-indigo-border)] flex items-center justify-center animate-pulse">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-indigo)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--text-secondary)]">Computing impact...</p>
            <p className="text-xs text-[var(--text-muted)] mt-1.5">Checking your schedule for consequences</p>
            <div className="w-full h-1 rounded-full bg-[var(--bg-elevated)] mt-6 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, transparent, var(--accent-indigo), transparent)`,
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.5s infinite",
                  width: "100%",
                }}
              />
            </div>
          </div>
        )}

        {/* ── Consequence ── */}
        {step === "consequence" && consequence && (
          <div>
            <div className="mb-3 px-1 flex items-center justify-between">
              <button
                onClick={() => setStep("form")}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5m7-7-7 7 7 7" />
                </svg>
                Back
              </button>
              <span className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">"{title}"</span>
            </div>
            <ConsequencePanel
              result={consequence}
              loading={saving}
              onAccept={() => commitTask({ isSoftDeadline: false })}
              onSoftDeadline={() => commitTask({ isSoftDeadline: true })}
              onUseSuggestedDate={() =>
                commitTask({ isSoftDeadline: false, deadlineOverride: consequence.suggestedDate ?? deadline })
              }
              onCancel={onClose}
            />
          </div>
        )}

        {/* ── Saving ── */}
        {step === "saving" && (
          <div className="animate-scale-in bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl px-5 py-10 text-center">
            <p className="text-sm text-[var(--text-secondary)]">Saving task and updating schedule...</p>
          </div>
        )}
      </div>
    </div>
  );
}
