"use client";

const TYPE_LABELS: Record<string, string> = {
  habit: "Habit",
  admin: "Admin",
  standard: "Task",
  deep_work: "Deep Work",
  unknown: "Task",
};

const TYPE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  habit:     { text: "text-[var(--sky)]",    bg: "bg-[var(--sky-bg)]",    border: "border-[var(--sky-border)]" },
  admin:     { text: "text-[var(--text-tertiary)]", bg: "bg-[rgba(113,113,122,0.08)]", border: "border-[rgba(113,113,122,0.2)]" },
  standard:  { text: "text-[var(--accent-indigo)]", bg: "bg-[var(--accent-indigo-bg)]", border: "border-[var(--accent-indigo-border)]" },
  deep_work: { text: "text-[var(--violet)]", bg: "bg-[var(--violet-bg)]", border: "border-[var(--violet-border)]" },
  unknown:   { text: "text-[var(--text-tertiary)]", bg: "bg-[rgba(113,113,122,0.08)]", border: "border-[rgba(113,113,122,0.2)]" },
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
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return `${diff}d left`;
}

function isOverdue(dateStr: string): boolean {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function isDueToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split("T")[0];
}

export function TaskCard({ task, onComplete, onStartSession }: Props) {
  const overdue = isOverdue(task.deadline_date) && task.status !== "completed";
  const dueToday = isDueToday(task.deadline_date);
  const deadlineLabel = formatDeadline(task.deadline_date);
  const colors = (TYPE_COLORS[task.type] ?? TYPE_COLORS["unknown"])!;

  return (
    <div
      className={`bg-[var(--bg-surface)] border rounded-2xl p-4 transition-all duration-200 group ${
        task.status === "completed"
          ? "border-[var(--border-subtle)] opacity-50"
          : overdue
          ? "border-[var(--red-border)] hover:border-[var(--red)]"
          : "border-[var(--border-subtle)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-elevated)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Completion checkbox */}
          <button
            onClick={() => task.status !== "completed" && onComplete?.(task.id)}
            className="mt-0.5 shrink-0"
            title="Mark complete"
          >
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                task.status === "completed"
                  ? "border-[var(--emerald)] bg-[var(--emerald)]"
                  : "border-[var(--border-medium)] group-hover:border-[var(--accent-indigo)] hover:bg-[var(--accent-indigo-bg)]"
              }`}
            >
              {task.status === "completed" && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </button>

          <div className="min-w-0">
            <p
              className={`text-sm font-medium leading-snug ${
                task.status === "completed"
                  ? "text-[var(--text-muted)] line-through"
                  : "text-[var(--text-primary)]"
              }`}
            >
              {task.title}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${colors.text} ${colors.bg} ${colors.border}`}
              >
                {TYPE_LABELS[task.type] ?? "Task"}
              </span>
              <span className="mono text-[11px] text-[var(--text-muted)]">
                {task.estimated_minutes}m
              </span>
              {task.is_fixed && (
                <span className="flex items-center gap-1 text-[11px] text-[var(--amber)]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                  </svg>
                  pinned
                </span>
              )}
              {task.is_soft_deadline && (
                <span className="text-[11px] text-[var(--text-muted)]">flexible</span>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <span
            className={`text-[11px] font-medium ${
              overdue
                ? "text-[var(--red)]"
                : dueToday
                ? "text-[var(--amber)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            {deadlineLabel}
          </span>
        </div>
      </div>

      {task.status !== "completed" && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex gap-4">
          <button
            onClick={() => onStartSession?.(task.id)}
            className="text-xs text-[var(--accent-indigo)] hover:text-[var(--accent-indigo-solid)] font-medium transition-colors flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            Log time
          </button>
        </div>
      )}
    </div>
  );
}
