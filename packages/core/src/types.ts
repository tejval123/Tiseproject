// ─── Enums ────────────────────────────────────────────────────────────────────

export type TaskType = "habit" | "admin" | "standard" | "deep_work" | "unknown";

export type SchedulingMode = "suggest" | "auto";

export type SystemMode = "warm_start" | "calibration" | "personalized" | "autopilot";

export type SlipLevel = 1 | 2 | 3;

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type RebalanceAction = "move" | "pin_respected" | "skipped_near_term";

// ─── Core Domain Objects ──────────────────────────────────────────────────────

export interface Task {
  id: string;
  userId: string;
  title: string;
  type: TaskType;
  estimatedMinutes: number;
  deadlineDate: string; // ISO date string YYYY-MM-DD
  status: TaskStatus;
  isFixed: boolean;      // user-pinned, engine must not move
  isSoftDeadline: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleBlock {
  id: string;
  taskId: string;
  userId: string;
  date: string;          // YYYY-MM-DD
  startMinute: number;   // minutes from midnight, e.g. 540 = 9:00am
  durationMinutes: number;
  isFixed: boolean;
  rebalancePlanId?: string;
}

export interface TimeSession {
  id: string;
  taskId: string;
  userId: string;
  date: string;
  estimatedMinutes: number;
  actualMinutes: number;
  isValid: boolean;      // minimum 5 min actual to count for PEV
  completedAt: string;
}

export interface CapacityProfile {
  userId: string;
  weekdayMinutes: number;
  weekendMinutes: number;
  preferredStartMinute: number; // default 540 (9am)
  schedulingMode: SchedulingMode;
  systemMode: SystemMode;
  completedTaskCount: number;
  sessionCount: number;
  daysActive: number;
}

export interface DayCapacity {
  date: string;
  declaredMinutes: number;
  effectiveMinutes: number;  // declaredMinutes * 0.75 — never expose to user
  scheduledMinutes: number;
  timeBankMinutes: number;
}

export interface TimeBankState {
  userId: string;
  date: string;
  balanceMinutes: number;
}

export interface RebalancePlan {
  id: string;
  userId: string;
  triggeredAt: string;
  slipLevel: SlipLevel;
  moves: RebalanceMove[];
  accepted: boolean;
}

export interface RebalanceMove {
  blockId: string;
  taskId: string;
  taskTitle: string;
  action: RebalanceAction;
  before: { date: string; startMinute: number };
  after: { date: string; startMinute: number };
  reason: string;
}

// ─── Consequence Engine Types ─────────────────────────────────────────────────

export interface ConsequenceInput {
  newTask: Pick<Task, "type" | "estimatedMinutes" | "deadlineDate">;
  existingBlocks: ScheduleBlock[];
  existingTasks: Task[];
  dayCapacities: DayCapacity[];
  pev: number;           // Personal Execution Velocity
  today: string;         // YYYY-MM-DD
}

export interface ConsequenceResult {
  adjustedEffort: number;          // AE in minutes
  isFeasible: boolean;
  consecutiveOverloadDays: number;
  tasksOnTime: TaskImpact[];
  tasksSlipping: TaskImpact[];
  deepWorkAffected: boolean;
  bufferCost: number;              // invisible buffer minutes consumed
  timeBankCanAbsorb: boolean;
  suggestedDate: string | null;    // earliest feasible date
}

export interface TaskImpact {
  taskId: string;
  title: string;
  originalDeadline: string;
  projectedDeadline: string;
  slipDays: number;
}

// ─── Slip Detection Types ─────────────────────────────────────────────────────

export interface SlipInput {
  overdueMinutes: number;
  actualMinutes: number;
  budgetedMinutes: number;
  postponeCount: number;
  dailyOverloadRatio: number;      // scheduledMinutes / effectiveMinutes
}

export interface SlipScore {
  score: number;
  level: SlipLevel;
}

// ─── Complexity Multipliers (from PRD §5.1.4) ─────────────────────────────────

export const COMPLEXITY_MULTIPLIER: Record<TaskType, number> = {
  habit: 0.8,
  admin: 1.0,
  standard: 1.2,
  deep_work: 1.6,
  unknown: 1.8,
};

// ─── System Constants ─────────────────────────────────────────────────────────

export const EFFECTIVE_CAPACITY_RATIO = 0.75;
export const DEFAULT_PEV = 1.25;
export const TIME_BANK_MAX_PER_TASK_RATIO = 0.25;
export const TIME_BANK_CAP_PER_TASK_MINUTES = 15;
export const PEV_ACTIVATION_MIN_TASKS = 10;
export const PEV_ACTIVATION_MIN_SESSIONS = 8;
export const PEV_ACTIVATION_MIN_DAYS = 2;
export const REBALANCE_MAX_MOVE_RATIO = 0.3;
export const REBALANCE_MAX_TASKS = 3;
export const NEAR_TERM_LOCK_HOURS = 12;
export const CRITICAL_OVERLOAD_CONSECUTIVE_DAYS = 3;
