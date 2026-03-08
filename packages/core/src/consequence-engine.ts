import {
  COMPLEXITY_MULTIPLIER,
  CRITICAL_OVERLOAD_CONSECUTIVE_DAYS,
  ConsequenceInput,
  ConsequenceResult,
  DayCapacity,
  Task,
  TaskImpact,
} from "./types";

// ─── Step 1–4: Compute Adjusted Effort ───────────────────────────────────────

export function computeAdjustedEffort(
  estimatedMinutes: number,
  taskType: Task["type"],
  pev: number
): number {
  const cm = COMPLEXITY_MULTIPLIER[taskType];
  const tes = estimatedMinutes * cm;       // Task Effort Score
  return Math.ceil(tes * pev);             // Adjusted Effort
}

// ─── Step 5: Available Focus Capacity per day ────────────────────────────────

export function getAFC(day: DayCapacity): number {
  return (
    day.effectiveMinutes - day.scheduledMinutes + day.timeBankMinutes
  );
}

// ─── Step 6: Consequence computation ─────────────────────────────────────────

export function computeConsequence(input: ConsequenceInput): ConsequenceResult {
  const { newTask, existingBlocks, existingTasks, dayCapacities, pev, today } = input;

  const ae = computeAdjustedEffort(newTask.estimatedMinutes, newTask.type, pev);

  // Build map of days from today to deadline
  const deadline = newTask.deadlineDate;
  const days = dayCapacities
    .filter((d) => d.date >= today && d.date <= deadline)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Cumulative AFC check — can we fit AE before deadline?
  let cumulativeAFC = 0;
  let suggestedDate: string | null = null;
  let overloadDays = 0;
  let consecutiveOverload = 0;
  let maxConsecutiveOverload = 0;

  for (const day of days) {
    const afc = getAFC(day);
    if (afc <= 0) {
      overloadDays++;
      consecutiveOverload++;
      maxConsecutiveOverload = Math.max(maxConsecutiveOverload, consecutiveOverload);
    } else {
      consecutiveOverload = 0;
    }
    cumulativeAFC += Math.max(0, afc);
    if (cumulativeAFC >= ae && suggestedDate === null) {
      suggestedDate = day.date;
    }
  }

  const isFeasible = cumulativeAFC >= ae;

  // Determine which existing tasks slip
  // A task slips if its blocks land on days where adding AE would cause overflow
  const tasksOnTime: TaskImpact[] = [];
  const tasksSlipping: TaskImpact[] = [];

  // Build per-day overflow map: how much capacity is stolen by new task each day
  const remainingAE = { value: ae };
  const capacityStolen = new Map<string, number>();

  for (const day of days) {
    if (remainingAE.value <= 0) break;
    const afc = getAFC(day);
    const steal = Math.min(Math.max(0, afc), remainingAE.value);
    capacityStolen.set(day.date, steal);
    remainingAE.value -= steal;
  }

  // For each existing task, check if any of its blocks are on affected days
  const affectedDates = new Set(capacityStolen.keys());

  for (const task of existingTasks) {
    if (task.status === "completed" || task.status === "cancelled") continue;

    const taskBlocks = existingBlocks
      .filter((b) => b.taskId === task.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (taskBlocks.length === 0) continue;

    const lastBlock = taskBlocks[taskBlocks.length - 1];
    const hasAffectedBlock = taskBlocks.some((b) => affectedDates.has(b.date));

    if (!hasAffectedBlock || task.isSoftDeadline) {
      tasksOnTime.push({
        taskId: task.id,
        title: task.title,
        originalDeadline: task.deadlineDate,
        projectedDeadline: task.deadlineDate,
        slipDays: 0,
      });
      continue;
    }

    // Estimate slip: push last block date by stolen days
    const stolenDays = [...affectedDates].filter((d) =>
      taskBlocks.some((b) => b.date === d)
    ).length;

    if (stolenDays === 0 || !lastBlock || lastBlock.date < today) {
      tasksOnTime.push({
        taskId: task.id,
        title: task.title,
        originalDeadline: task.deadlineDate,
        projectedDeadline: task.deadlineDate,
        slipDays: 0,
      });
    } else {
      const projected = addWorkingDays(task.deadlineDate, stolenDays);
      tasksSlipping.push({
        taskId: task.id,
        title: task.title,
        originalDeadline: task.deadlineDate,
        projectedDeadline: projected,
        slipDays: stolenDays,
      });
    }
  }

  // Deep work affected if any deep_work task is in slipping list
  const deepWorkAffected = tasksSlipping.some((t) => {
    const task = existingTasks.find((et) => et.id === t.taskId);
    return task?.type === "deep_work";
  });

  // Buffer cost: how many invisible buffer minutes are consumed
  // Buffer = effectiveMinutes gap per day
  const bufferCost = [...capacityStolen.values()].reduce((a, b) => a + b, 0);

  // Time bank absorption: sum of all time bank minutes on affected days
  const timeBankTotal = days
    .filter((d) => affectedDates.has(d.date))
    .reduce((sum, d) => sum + d.timeBankMinutes, 0);

  return {
    adjustedEffort: ae,
    isFeasible,
    consecutiveOverloadDays: maxConsecutiveOverload,
    tasksOnTime,
    tasksSlipping,
    deepWorkAffected,
    bufferCost,
    timeBankCanAbsorb: timeBankTotal >= ae,
    suggestedDate: suggestedDate ?? findNextFeasibleDate(dayCapacities, ae, deadline),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addWorkingDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) added++; // skip weekends
  }
  return date.toISOString().split("T")[0]!;
}

function findNextFeasibleDate(
  dayCapacities: DayCapacity[],
  ae: number,
  afterDate: string
): string | null {
  let cumulative = 0;
  const futureDays = dayCapacities
    .filter((d) => d.date > afterDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const day of futureDays) {
    cumulative += Math.max(0, getAFC(day));
    if (cumulative >= ae) return day.date;
  }
  return null;
}

export function isCriticalOverload(result: ConsequenceResult): boolean {
  return result.consecutiveOverloadDays >= CRITICAL_OVERLOAD_CONSECUTIVE_DAYS;
}
