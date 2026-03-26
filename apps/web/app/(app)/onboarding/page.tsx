"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useRouter } from "next/navigation";

const MODES = [
  {
    value: "suggest",
    label: "Suggest",
    desc: "TISE recommends where to place tasks. You confirm each move.",
    icon: "💡",
  },
  {
    value: "auto",
    label: "Auto-place",
    desc: "TISE places tasks automatically. You can always adjust.",
    icon: "⚡",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0=welcome, 1=capacity, 2=window, 3=mode, 4=done
  const [weekdayHours, setWeekdayHours] = useState(6);
  const [weekendHours, setWeekendHours] = useState(2);
  const [startHour, setStartHour] = useState(9);
  const [schedulingMode, setSchedulingMode] = useState<"suggest" | "auto">("suggest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatTime = (h: number) =>
    h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`;

  async function handleSave() {
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error: upsertError } = await supabase.from("capacity_profiles").upsert({
      user_id: user.id,
      weekday_minutes: weekdayHours * 60,
      weekend_minutes: weekendHours * 60,
      preferred_start_minute: startHour * 60,
      scheduling_mode: schedulingMode,
      system_mode: "warm_start",
    }, { onConflict: "user_id" });

    if (upsertError) { setError(upsertError.message); setLoading(false); return; }
    setStep(4);
    setLoading(false);
  }

  // Welcome screen
  if (step === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="animate-fade-up mb-12">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
              style={{
                background: "linear-gradient(135deg, #6366f1, #818cf8)",
                boxShadow: "0 8px 32px rgba(99,102,241,0.3)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-[var(--text-primary)]">
              Your schedule<br />should heal itself.
            </h1>
            <p className="text-sm text-[var(--text-tertiary)] mt-3 leading-relaxed max-w-xs">
              TISE learns how you work, protects your deadlines, and repairs your plan when life happens.
            </p>
          </div>

          <div className="animate-fade-up stagger-2 space-y-3 mb-10">
            {[
              { icon: "🛡", text: "Blocks unrealistic commitments" },
              { icon: "🔄", text: "Auto-repairs when you fall behind" },
              { icon: "⏱", text: "Rewards efficiency with Time Bank" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-[13px] text-[var(--text-secondary)]">{item.text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep(1)}
            className="animate-fade-up stagger-4 w-full py-3.5 rounded-2xl text-sm font-semibold text-white border-none cursor-pointer"
            style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
          >
            Get started
          </button>
          <p className="animate-fade-up stagger-5 text-center text-xs text-[var(--text-muted)] mt-3">
            Takes about 30 seconds
          </p>
        </div>
      </div>
    );
  }

  // Setup steps + Done
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Progress bar */}
        <div className="animate-fade-in flex gap-1 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className="flex-1 h-1 rounded-full transition-all duration-300"
              style={{ background: s <= step ? "var(--accent-indigo)" : "var(--border-subtle)" }}
            />
          ))}
        </div>

        {/* Step 1: Capacity */}
        {step === 1 && (
          <div className="animate-fade-up">
            <p className="text-[11px] font-semibold text-[var(--accent-indigo)] uppercase tracking-widest mb-2">
              Focus capacity
            </p>
            <h2 className="text-2xl font-bold tracking-tight mb-1">How much can you focus?</h2>
            <p className="text-[13px] text-[var(--text-tertiary)] mb-8">
              Be honest — TISE uses this to keep plans realistic.
            </p>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 mb-4">
              <div className="flex justify-between items-baseline mb-4">
                <span className="text-[13px] font-medium">Weekdays</span>
                <span className="mono text-2xl font-bold text-[var(--accent-indigo)]">{weekdayHours}h</span>
              </div>
              <input
                type="range" min={1} max={12} value={weekdayHours}
                onChange={(e) => setWeekdayHours(Number(e.target.value))}
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-[var(--text-muted)]">1h</span>
                <span className="text-[10px] text-[var(--text-muted)]">12h</span>
              </div>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5">
              <div className="flex justify-between items-baseline mb-4">
                <span className="text-[13px] font-medium">Weekends</span>
                <span className="mono text-2xl font-bold text-[var(--accent-indigo)]">{weekendHours}h</span>
              </div>
              <input
                type="range" min={0} max={8} value={weekendHours}
                onChange={(e) => setWeekendHours(Number(e.target.value))}
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-[var(--text-muted)]">0h</span>
                <span className="text-[10px] text-[var(--text-muted)]">8h</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Work window */}
        {step === 2 && (
          <div className="animate-fade-up">
            <p className="text-[11px] font-semibold text-[var(--accent-indigo)] uppercase tracking-widest mb-2">
              Work window
            </p>
            <h2 className="text-2xl font-bold tracking-tight mb-1">When do you start?</h2>
            <p className="text-[13px] text-[var(--text-tertiary)] mb-8">
              We&apos;ll schedule around your natural rhythm.
            </p>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 mb-4">
              <div className="flex justify-between items-baseline mb-5">
                <span className="text-[13px] font-medium">Start time</span>
                <span className="mono text-2xl font-bold text-[var(--accent-indigo)]">{formatTime(startHour)}</span>
              </div>
              <input
                type="range" min={5} max={12} value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-[var(--text-muted)]">5 AM</span>
                <span className="text-[10px] text-[var(--text-muted)]">12 PM</span>
              </div>
            </div>

            {/* Visual timeline preview */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5">
              <p className="text-[11px] text-[var(--text-muted)] mb-3">Your focus window</p>
              <div className="h-8 rounded-lg bg-[var(--bg-elevated)] relative overflow-hidden">
                <div
                  className="absolute h-full rounded-lg border border-[var(--accent-indigo-border)] transition-all duration-300"
                  style={{
                    left: `${((startHour - 5) / 19) * 100}%`,
                    width: `${(weekdayHours / 19) * 100}%`,
                    background: "linear-gradient(90deg, rgba(99,102,241,0.3), rgba(99,102,241,0.1))",
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-[var(--text-muted)]">5 AM</span>
                <span className="text-[10px] text-[var(--text-muted)]">12 AM</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Scheduling mode */}
        {step === 3 && (
          <div className="animate-fade-up">
            <p className="text-[11px] font-semibold text-[var(--accent-indigo)] uppercase tracking-widest mb-2">
              Control level
            </p>
            <h2 className="text-2xl font-bold tracking-tight mb-1">How much help?</h2>
            <p className="text-[13px] text-[var(--text-tertiary)] mb-8">
              You can change this anytime from settings.
            </p>

            <div className="space-y-3">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setSchedulingMode(m.value as "suggest" | "auto")}
                  className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
                    schedulingMode === m.value
                      ? "border-[var(--border-focus)] bg-[var(--accent-indigo-bg)]"
                      : "border-[var(--border-subtle)] hover:border-[var(--border-medium)]"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-xl">{m.icon}</span>
                    <span className={`text-[15px] font-semibold ${
                      schedulingMode === m.value ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                    }`}>
                      {m.label}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)] ml-9 leading-relaxed">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="animate-fade-up text-center py-8">
            <div
              className="animate-glow w-16 h-16 mx-auto rounded-3xl flex items-center justify-center mb-6 text-3xl text-white"
              style={{ background: "linear-gradient(135deg, #4f46e5, #818cf8)" }}
            >
              ✓
            </div>
            <h2 className="text-2xl font-bold tracking-tight">You&apos;re all set</h2>
            <p className="text-[13px] text-[var(--text-tertiary)] mt-2 max-w-xs mx-auto leading-relaxed">
              TISE is in <strong className="text-[var(--accent-indigo)]">Learning mode</strong>. It&apos;ll start with
              safe suggestions and get smarter as you work.
            </p>

            <div className="mt-8 inline-flex items-center gap-5 px-5 py-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div>
                <span className="mono text-lg font-bold text-[var(--accent-indigo)]">{weekdayHours}h</span>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">weekday</p>
              </div>
              <div className="w-px h-8 bg-[var(--border-subtle)]" />
              <div>
                <span className="mono text-lg font-bold text-[var(--accent-indigo)]">{weekendHours}h</span>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">weekend</p>
              </div>
              <div className="w-px h-8 bg-[var(--border-subtle)]" />
              <div>
                <span className="mono text-lg font-bold text-[var(--accent-indigo)]">{formatTime(startHour)}</span>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">start</p>
              </div>
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              className="mt-8 w-full py-3.5 rounded-2xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #059669, #34d399)" }}
            >
              Open My Day →
            </button>
          </div>
        )}

        {/* Navigation buttons (steps 1-3) */}
        {step >= 1 && step <= 3 && (
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-5 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[13px] font-medium hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (step === 3) handleSave();
                else setStep(step + 1);
              }}
              disabled={loading}
              className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
              style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
            >
              {loading ? "Saving..." : step === 3 ? "Start using TISE" : "Continue"}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 text-xs text-[var(--red)] bg-[var(--red-bg)] border border-[var(--red-border)] rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
