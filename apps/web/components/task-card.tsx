"use client";

const TYPE_LABELS: Record<string, string> = {
  habit: "Habit",
  admin: "Admin",
  standard: "Task",
  deep_work: "Deep Work",
  unknown: "Task",
};

const TYPE_COLORS: Record<string, string> = {
  habit: "text-sky-400 bg-sky-400/10 border-sky-400/20",
  admin: "text-neutral-400 bg-neutral-400/10 border-neutral-400/20",
  standard: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
  deep_work: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  unknown: "text-neutral-400 bg-neutral-400/10 border-neutral-400/20",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-neutral-600",
  in_progress: "bg-indigo-500",
  completed: "bg-emerald-500",
  cancelled: "bg-red-500",
};

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

interface Props {
  task: Task;
  onComplete?: (id: string) => void;
  onStartSession?: (id: string) => void;
}

function formatDeadline(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return `${diff}d left`;
}

function isOverdue(dateStr: string): boolean {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export function TaskCard({ task, onComplete, onStartSession }: Props) {
  const overdue = isOverdue(task.deadline_date) && task.status !== "completed";
  const deadlineLabel = formatDeadline(task.deadline_date);

  return (
    <div className={`bg-neutral-900 border rounded-xl p-4 transition-colors ${
      task.status === "completed"
        ? "border-neutral-800 opacity-60"
        : overdue
        ? "border-red-500/40"
        : "border-neutral-800 hover:border-neutral-700"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Status dot */}
          <button
            onClick={() => task.status !== "completed" && onComplete?.(task.id)}
            className="mt-0.5 shrink-0"
            title="Mark complete"
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
              task.status === "completed"
                ? "border-emerald-500 bg-emerald-500"
                : "border-neutral-600 hover:border-indigo-400"
            }`}>
              {task.status === "completed" && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </button>

          <div className="min-w-0">
            <p className={`text-sm font-medium leading-snug ${
              task.status === "completed" ? "text-neutral-500 line-through" : "text-white"
            }`}>
              {task.title}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[task.type] ?? TYPE_COLORS.unknown}`}>
                {TYPE_LABELS[task.type] ?? "Task"}
              </span>
              <span className="text-xs text-neutral-500">{task.estimated_minutes}m</span>
              {task.is_fixed && (
                <span className="text-xs text-amber-400">pinned</span>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <span className={`text-xs font-medium ${
            overdue ? "text-red-400" : task.deadline_date === new Date().toISOString().split("T")[0] ? "text-amber-400" : "text-neutral-500"
          }`}>
            {deadlineLabel}
          </span>
        </div>
      </div>

      {task.status !== "completed" && (
        <div className="mt-3 pt-3 border-t border-neutral-800 flex gap-2">
          <button
            onClick={() => onStartSession?.(task.id)}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            Log time
          </button>
        </div>
      )}
    </div>
  );
}
