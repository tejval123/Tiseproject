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
      supabase.from("capacity_profiles").select("system_mode").maybeSingle(),
    ]);

    if (tasksRes.ok) {
      const data = await tasksRes.json();
      setTasks(data ?? []);
    }

    setTimeBankMinutes(bankRes.data?.balance_minutes ?? 0);

    if (profileRes.data?.system_mode) {
      setSystemMode(profileRes.data.system_mode);
    } else {
      // No profile yet — send to onboarding
      router.push("/onboarding");
      return;
    }

    setLoading(false);
  }

  async function handleComplete(taskId: string) {
    const auth = await getAuthHeader();
    if (!auth) return;
    await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "completed" } : t));
  }

  const pendingTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const overdueTasks = pendingTasks.filter((t) => t.deadline_date < new Date().toISOString().split("T")[0]!);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Top nav */}
      <header className="border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight text-white">TISE</span>
        <div className="flex items-center gap-3">
          {systemMode === "warm_start" && (
            <span className="text-xs text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 px-2.5 py-1 rounded-full">
              Learning mode
            </span>
          )}
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
            className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* Date + Time Bank */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">My Day</p>
            <h1 className="text-xl font-semibold text-white mt-0.5">{getTodayLabel()}</h1>
          </div>
          <TimeBankBadge minutes={timeBankMinutes} />
        </div>

        {/* Overdue alert */}
        {overdueTasks.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <p className="text-sm font-medium text-red-400">
              {overdueTasks.length} overdue {overdueTasks.length === 1 ? "task" : "tasks"}
            </p>
            <p className="text-xs text-red-400/70 mt-0.5">
              TISE may suggest a rebalance. Review your schedule.
            </p>
          </div>
        )}

        {/* Task list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : pendingTasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-neutral-500 text-sm">No active tasks.</p>
            <p className="text-neutral-600 text-xs mt-1">Add your first task to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={handleComplete}
                onStartSession={(id) => setSessionTaskId(id)}
              />
            ))}
          </div>
        )}

        {/* Completed tasks */}
        {completedTasks.length > 0 && (
          <div>
            <p className="text-xs text-neutral-600 uppercase tracking-wider mb-2">
              Completed today ({completedTasks.length})
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
        className="fixed bottom-6 right-6 w-12 h-12 bg-indigo-600 hover:bg-indigo-500 rounded-full shadow-lg flex items-center justify-center transition-colors"
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
