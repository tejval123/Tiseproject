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

    // Show message briefly then close
    setTimeout(() => onLogged(), 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Log time</h2>
            <p className="text-xs text-neutral-500 mt-0.5 truncate max-w-xs">{task.title}</p>
          </div>
          <button onClick={onClose} className="text-neutral-600 hover:text-neutral-400 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {bankMessage ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-medium text-emerald-400">{bankMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <div className="bg-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-400">
              Estimated: {task.estimated_minutes}m
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Actual time spent</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number" min={0} max={16} value={actualHours}
                    onChange={(e) => setActualHours(Number(e.target.value))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <p className="text-xs text-neutral-600 mt-1 text-center">hours</p>
                </div>
                <div className="flex-1">
                  <select
                    value={actualMins}
                    onChange={(e) => setActualMins(Number(e.target.value))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {[0, 15, 30, 45].map(m => <option key={m} value={m}>{m} min</option>)}
                  </select>
                  <p className="text-xs text-neutral-600 mt-1 text-center">minutes</p>
                </div>
              </div>
            </div>

            {actualTotal > 0 && (
              <div className={`text-xs px-3 py-2 rounded-lg border ${
                diff > 0
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  : diff < 0
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-neutral-800 border-neutral-700 text-neutral-400"
              }`}>
                {diff > 0
                  ? `${diff}m over — Time Bank will help absorb this`
                  : diff < 0
                  ? `${Math.abs(diff)}m under — earning Time Bank minutes`
                  : "Right on estimate"}
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || actualTotal < 1}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? "Logging..." : "Log session"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
