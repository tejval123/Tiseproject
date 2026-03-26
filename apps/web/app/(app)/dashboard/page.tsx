"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { TimeBankBadge } from "../../../components/time-bank-badge";
import { TaskCard } from "../../../components/task-card";
import { AddTaskModal } from "../../../components/add-task-modal";
import { LogSessionModal } from "../../../components/log-session-modal";

interface Task {
  id: string;
  title: string;
  type: string;
  status: string;
  estimated_minutes: number;
  deadline_date: string;
  is_fixed: boolean;
  is_soft_deadline: boolean;
}

function getTodayLabel(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? `Bearer ${session.access_token}` : null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBankMinutes, setTimeBankMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sessionTaskId, setSessionTaskId] = useState<string | null>(null);
  const [systemMode, setSystemMode] = useState<string>("warm_start");
  const [capacityMinutes, setCapacityMinutes] = useState(480);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      fetchData();
    });
  }, []);

  async function fetchData() {
    setLoading(true);
    const auth = await getAuthHeader();
    if (!auth) { router.push("/login"); return; }

    const today = new Date().toISOString().split("T")[0]!;

    const [tasksRes, bankRes, profileRes] = await Promise.all([
      fetch("/api/tasks", { headers: { Authorization: auth } }),
      supabase.from("time_bank").select("balance_minutes").eq("date", today).maybeSingle(),
      supabase.from("capacity_profiles").select("system_mode, weekday_minutes, weekend_minutes").maybeSingle(),
    ]);

    if (tasksRes.ok) {
      const data = await tasksRes.json();
      setTasks(data ?? []);
    }

    setTimeBankMinutes(bankRes.data?.balance_minutes ?? 0);

    if (profileRes.data?.system_mode) {
      setSystemMode(profileRes.data.system_mode);
      const dow = new Date().getDay();
      const declared = dow === 0 || dow === 6
        ? profileRes.data.weekend_minutes
        : profileRes.data.weekday_minutes;
      setCapacityMinutes(declared);
    } else {
      router.push("/onboarding");
      return;
    }

    setLoading(false);
  }

  async function handleComplete(taskId: string) {
    const auth = await getAuthHeader();
    if (!auth) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
    if (user) {
      await supabase.rpc("increment_completed_task_count", { uid: user.id });
    }
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "completed" } : t));
  }

  const pendingTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const overdueTasks = pendingTasks.filter((t) => t.deadline_date < new Date().toISOString().split("T")[0]!);
  const totalScheduledMinutes = pendingTasks.reduce((sum, t) => sum + t.estimated_minutes, 0);
  const usagePercent = Math.min((totalScheduledMinutes / capacityMinutes) * 100, 100);

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--text-primary)]">
      {/* Top nav — glass effect */}
      <header className="glass sticky top-0 z-10 border-b border-[var(--border-subtle)] px-4 py-3 flex items-center justify-between bg-[rgba(9,9,11,0.85)]">
        <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">TISE</span>
        <div className="flex items-center gap-3">
          {systemMode === "warm_start" && (
            <span className="text-[11px] font-medium text-[var(--accent-indigo)] bg-[var(--accent-indigo-bg)] border border-[var(--accent-indigo-border)] px-2.5 py-1 rounded-full">
              Learning mode
            </span>
          )}
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-5 pb-24">
        {/* Date + Time Bank */}
        <div className="animate-fade-up flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-widest">My Day</p>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mt-1 tracking-tight">{getTodayLabel()}</h1>
          </div>
          <TimeBankBadge minutes={timeBankMinutes} />
        </div>

        {/* Capacity bar */}
        <div className="animate-fade-up stagger-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs text-[var(--text-tertiary)]">Today&apos;s capacity</span>
            <span className={`mono text-xs font-medium ${usagePercent > 90 ? "text-[var(--amber)]" : "text-[var(--text-secondary)]"}`}>
              {totalScheduledMinutes}m / {capacityMinutes}m
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${usagePercent}%`,
                background: usagePercent > 90
                  ? "linear-gradient(90deg, var(--amber), var(--red))"
                  : "linear-gradient(90deg, var(--accent-indigo-solid), var(--violet))",
              }}
            />
          </div>
        </div>

        {/* Overdue alert */}
        {overdueTasks.length > 0 && (
          <div className="animate-fade-up stagger-2 bg-[var(--red-bg)] border border-[var(--red-border)] rounded-2xl px-4 py-3 flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <path d="M12 9v4m0 4h.01" />
            </svg>
            <div>
              <p className="text-sm font-medium text-[var(--red)]">
                {overdueTasks.length} overdue {overdueTasks.length === 1 ? "task" : "tasks"}
              </p>
              <p className="text-xs text-[var(--red)] opacity-70 mt-0.5">
                TISE may suggest a rebalance. Review your schedule.
              </p>
            </div>
          </div>
        )}

        {/* Task list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 animate-pulse h-24"
              />
            ))}
          </div>
        ) : pendingTasks.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <p className="text-[var(--text-muted)] text-sm">No active tasks</p>
            <p className="text-[var(--text-muted)] text-xs mt-1 opacity-60">Add your first task to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTasks.map((task, i) => (
              <div key={task.id} className={`animate-fade-up stagger-${Math.min(i + 2, 6)}`}>
                <TaskCard
                  task={task}
                  onComplete={handleComplete}
                  onStartSession={(id) => setSessionTaskId(id)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Completed tasks */}
        {completedTasks.length > 0 && (
          <div className="animate-fade-in">
            <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-widest mb-3">
              Completed ({completedTasks.length})
            </p>
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Add task FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="animate-glow fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-[var(--accent-indigo-solid-hover)] to-[var(--accent-indigo-solid)] hover:from-[#4338ca] hover:to-[var(--accent-indigo-solid-hover)] rounded-2xl shadow-lg flex items-center justify-center transition-all duration-200"
        style={{ boxShadow: "0 8px 32px rgba(99,102,241,0.35)" }}
        aria-label="Add task"
      >
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Modals */}
      {showAddModal && (
        <AddTaskModal
          onClose={() => setShowAddModal(false)}
          onTaskAdded={() => { setShowAddModal(false); fetchData(); }}
        />
      )}
      {sessionTaskId && (
        <LogSessionModal
          taskId={sessionTaskId}
          task={tasks.find((t) => t.id === sessionTaskId)!}
          onClose={() => setSessionTaskId(null)}
          onLogged={() => { setSessionTaskId(null); fetchData(); }}
        />
      )}
    </div>
  );
}
