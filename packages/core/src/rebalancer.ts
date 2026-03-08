import {
  NEAR_TERM_LOCK_HOURS,
  REBALANCE_MAX_MOVE_RATIO,
  REBALANCE_MAX_TASKS,
  RebalanceMove,
  RebalancePlan,
  ScheduleBlock,
  SlipInput,
  SlipLevel,
  SlipScore,
  Task,
  DayCapacity,
} from "./types";

// ─── Slip Severity Score (PRD §5.3.3) ────────────────────────────────────────

export function computeSlipScore(input: SlipInput): SlipScore {
  const { overdueMinutes, actualMinutes, budgetedMinutes, postponeCount, dailyOverloadRatio } = input;

  const overduePart = (overdueMinutes / 60) * 2;
  const overrunPart = Math.max(0, (actualMinutes / Math.max(budgetedMinutes, 1) - 1) * 5);
  const postponePart = postponeCount * 1;
  const overloadPart = dailyOverloadRatio * 3;

  const score = overduePart + overrunPart + postponePart + overloadPart;

  let level: SlipLevel;
  if (score < 3) level = 1;
  else if (score < 7) level = 2;
  else level = 3;

  return { score: Math.round(score * 100) / 100, level };
}

// ─── Rebalancer ───────────────────────────────────────────────────────────────

export interface RebalanceInput {
  slipLevel: SlipLevel;
  blocks: ScheduleBlock[];
  tasks: Task[];
  dayCapacities: DayCapacity[];
  today: string;         // YYYY-MM-DD
  nowMinute: number;     // minutes from midnight right now
  existingPlanId?: string;
}

export function runRebalance(input: RebalanceInput): RebalancePlan {
  const { slipLevel, blocks, tasks, dayCapacities, today, nowMinute } = input;

  const planId = crypto.randomUUID();
  const moves: RebalanceMove[] = [];

  // Identify movable blocks
  const nearTermCutoffMinute = nowMinute + NEAR_TERM_LOCK_HOURS * 60;

  const candidateBlocks = blocks.filter((b) => {
    if (b.isFixed) return false;
    // Lock blocks starting within next 12 hours (same-day check)
    if (b.date === today && b.startMinute < nearTermCutoffMinute) return false;
    return true;
  });

  if (candidateBlocks.length === 0) {
    return { id: planId, userId: blocks[0]?.userId ?? "", triggeredAt: new Date().toISOString(), slipLevel, moves: [], accepted: false };
  }

  // Cap: move at most 30% of future blocks OR max 3 tasks — whichever is smaller
  const maxMoves = Math.min(
    Math.floor(candidateBlocks.length * REBALANCE_MAX_MOVE_RATIO),
    REBALANCE_MAX_TASKS
  );

  if (maxMoves === 0) {
    return { id: planId, userId: blocks[0]?.userId ?? "", triggeredAt: new Date().toISOString(), slipLevel, moves: [], accepted: false };
  }

  // Level 1: Local repair — use Time Bank, no block moves
  if (slipLevel === 1) {
    return {
      id: planId,
      userId: blocks[0]?.userId ?? "",
      triggeredAt: new Date().toISOString(),
      slipLevel,
      moves: [],
      accepted: false,
    };
  }

  // Level 2: Day rebalance — reorder today's remaining tasks
  // Level 3: Horizon rebalance — repack across next 14 days
  const horizonDate = addDays(today, slipLevel === 3 ? 14 : 0);

  const relevantBlocks = candidateBlocks
    .filter((b) => b.date >= today && b.date <= horizonDate)
    .sort((a, b) => {
      // Sort by deadline urgency: tasks with nearest deadlines move last
      const taskA = tasks.find((t) => t.id === a.taskId);
      const taskB = tasks.find((t) => t.id === b.taskId);
      if (!taskA || !taskB) return 0;
      return taskA.deadlineDate.localeCompare(taskB.deadlineDate);
    });

  // Build available capacity map
  const capacityMap = new Map<string, number>();
  for (const day of dayCapacities) {
    if (day.date >= today && day.date <= horizonDate) {
      capacityMap.set(day.date, day.effectiveMinutes - day.scheduledMinutes);
    }
  }

  // Try to move overloaded blocks to days with available capacity
  const tasksMoved = new Set<string>();
  let moveCount = 0;

  for (const block of relevantBlocks) {
    if (moveCount >= maxMoves) break;

    const task = tasks.find((t) => t.id === block.taskId);
    if (!task) continue;
    if (tasksMoved.has(task.id)) continue;

    const currentDayCapacity = capacityMap.get(block.date) ?? 0;
    if (currentDayCapacity >= 0) continue; // not overloaded, skip

    // Find first future day with enough capacity
    const targetDate = findDayWithCapacity(
      capacityMap,
      block.durationMinutes,
      block.date,
      task.deadlineDate
    );

    if (!targetDate || targetDate === block.date) continue;

    moves.push({
      blockId: block.id,
      taskId: task.id,
      taskTitle: task.title,
      action: "move",
      before: { date: block.date, startMinute: block.startMinute },
      after: { date: targetDate, startMinute: block.startMinute },
      reason: slipLevel === 3 ? "Horizon rebalance — overload prevention" : "Day rebalance — deadline protection",
    });

    // Update capacity map
    capacityMap.set(block.date, (capacityMap.get(block.date) ?? 0) + block.durationMinutes);
    capacityMap.set(targetDate, (capacityMap.get(targetDate) ?? 0) - block.durationMinutes);

    tasksMoved.add(task.id);
    moveCount++;
  }

  return {
    id: planId,
    userId: blocks[0]?.userId ?? "",
    triggeredAt: new Date().toISOString(),
    slipLevel,
    moves,
    accepted: false,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findDayWithCapacity(
  capacityMap: Map<string, number>,
  needed: number,
  afterDate: string,
  beforeDate: string
): string | null {
  const sorted = [...capacityMap.entries()]
    .filter(([date]) => date > afterDate && date <= beforeDate)
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [date, available] of sorted) {
    if (available >= needed) return date;
  }
  return null;
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0]!;
}
