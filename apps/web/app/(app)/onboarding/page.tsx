"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useRouter } from "next/navigation";

const MODES = [
  {
    value: "suggest",
    label: "Suggest",
    desc: "TISE recommends where to place tasks. You confirm.",
  },
  {
    value: "auto",
    label: "Auto-place",
    desc: "TISE places tasks automatically. You can adjust.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [weekdayHours, setWeekdayHours] = useState(6);
  const [weekendHours, setWeekendHours] = useState(2);
  const [startHour, setStartHour] = useState(9);
  const [schedulingMode, setSchedulingMode] = useState<"suggest" | "auto">("suggest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error } = await supabase.from("capacity_profiles").upsert({
      user_id: user.id,
      weekday_minutes: weekdayHours * 60,
      weekend_minutes: weekendHours * 60,
      preferred_start_minute: startHour * 60,
      scheduling_mode: schedulingMode,
      system_mode: "warm_start",
    }, { onConflict: "user_id" });

    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider">Setup</span>
          <h1 className="mt-2 text-2xl font-semibold text-white">How do you work?</h1>
          <p className="mt-1 text-sm text-neutral-500">
            TISE uses this to protect your schedule from day one. You can change it anytime.
          </p>
        </div>

        <div className="space-y-6">
          {/* Weekday focus */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium text-white">Weekday focus hours</label>
              <span className="text-lg font-semibold text-indigo-400">{weekdayHours}h</span>
            </div>
            <input
              type="range" min={1} max={12} value={weekdayHours}
              onChange={(e) => setWeekdayHours(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <p className="mt-2 text-xs text-neutral-500">
              Hours per weekday you can realistically focus on deep work.
            </p>
          </div>

          {/* Weekend focus */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium text-white">Weekend focus hours</label>
              <span className="text-lg font-semibold text-indigo-400">{weekendHours}h</span>
            </div>
            <input
              type="range" min={0} max={8} value={weekendHours}
              onChange={(e) => setWeekendHours(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          {/* Start time */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium text-white">Work start time</label>
              <span className="text-lg font-semibold text-indigo-400">
                {startHour < 12 ? `${startHour}:00 AM` : startHour === 12 ? "12:00 PM" : `${startHour - 12}:00 PM`}
              </span>
            </div>
            <input
              type="range" min={5} max={12} value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          {/* Scheduling mode */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <label className="text-sm font-medium text-white block mb-3">Scheduling mode</label>
            <div className="space-y-2">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setSchedulingMode(m.value as "suggest" | "auto")}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    schedulingMode === m.value
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-neutral-700 hover:border-neutral-600"
                  }`}
                >
                  <div className="text-sm font-medium text-white">{m.label}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-3 rounded-xl transition-colors"
          >
            {loading ? "Saving..." : "Start using TISE"}
          </button>
        </div>
      </div>
    </div>
  );
}
