"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { ConsequencePanel } from "./consequence-panel";
import type { ConsequenceResult } from "@repo/core";

const TASK_TYPES = [
  { value: "standard", label: "Standard" },
  { value: "deep_work", label: "Deep Work" },
  { value: "admin", label: "Admin" },
  { value: "habit", label: "Habit" },
];

interface Props {
  onClose: () => void;
  onTaskAdded: () => void;
}

type Step = "form" | "consequence" | "saving";

export function AddTaskModal({ onClose, onTaskAdded }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("standard");
  const [estimatedHours, setEstimatedHours] = useState(1);
  const [estimatedMins, setEstimatedMins] = useState(0);
  const [deadline, setDeadline] = useState("");
  const [consequence, setConsequence] = useState<ConsequenceResult | null>(null);
  const [softDeadline, setSoftDeadline] = useState(false);
  const [overrideDeadline, setOverrideDeadline] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
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
    setComputing(true);

    const auth = await getAuthHeader();
    if (!auth) { setError("Not authenticated"); setComputing(false); return; }

    const res = await fetch("/api/consequence", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({
        newTask: { type, estimatedMinutes: totalMinutes, deadlineDate: deadline },
      }),
    });

    if (!res.ok) { setError("Failed to compute consequence"); setComputing(false); return; }

    const data = await res.json();
    setConsequence(data);
    setStep("consequence");
    setComputing(false);
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
        {step === "form" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Add task</h2>
              <button onClick={onClose} className="text-neutral-600 hover:text-neutral-400 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCheckConsequence} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Task name</label>
                <input
                  type="text" required value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to get done?"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {TASK_TYPES.map((t) => (
                    <button
                      key={t.value} type="button"
                      onClick={() => setType(t.value)}
                      className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                        type === t.value
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                          : "border-neutral-700 text-neutral-400 hover:border-neutral-600"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Estimated time</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number" min={0} max={16} value={estimatedHours}
                      onChange={(e) => setEstimatedHours(Number(e.target.value))}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <p className="text-xs text-neutral-600 mt-1 text-center">hours</p>
                  </div>
                  <div className="flex-1">
                    <select
                      value={estimatedMins}
                      onChange={(e) => setEstimatedMins(Number(e.target.value))}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      {[0, 15, 30, 45].map(m => (
                        <option key={m} value={m}>{m} min</option>
                      ))}
                    </select>
                    <p className="text-xs text-neutral-600 mt-1 text-center">minutes</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Deadline</label>
                <input
                  type="date" required value={deadline}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={computing || totalMinutes < 5 || !deadline}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {computing ? "Computing impact..." : "See the impact"}
              </button>
            </form>
          </div>
        )}

        {step === "consequence" && consequence && (
          <div>
            <div className="mb-3 px-1 flex items-center justify-between">
              <button
                onClick={() => setStep("form")}
                className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                ← Back
              </button>
              <span className="text-xs text-neutral-600">"{title}"</span>
            </div>
            <ConsequencePanel
              result={consequence}
              loading={saving}
              onAccept={() => commitTask({ isSoftDeadline: softDeadline })}
              onSoftDeadline={() => commitTask({ isSoftDeadline: true })}
              onUseSuggestedDate={() =>
                commitTask({ isSoftDeadline: false, deadlineOverride: consequence.suggestedDate ?? deadline })
              }
              onCancel={onClose}
            />
          </div>
        )}

        {step === "saving" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-8 text-center">
            <p className="text-sm text-neutral-400">Saving task and updating schedule...</p>
          </div>
        )}
      </div>
    </div>
  );
}
