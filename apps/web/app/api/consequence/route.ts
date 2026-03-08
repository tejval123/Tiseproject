import { NextRequest, NextResponse } from "next/server";
import {
  computeConsequence,
  computePEV,
  ConsequenceInput,
  DayCapacity,
  EFFECTIVE_CAPACITY_RATIO,
  ScheduleBlock,
  Task,
  TimeSession,
} from "@repo/core";
import { createServerClient } from "../../../lib/supabase";

export async function POST(req: NextRequest) {
  const supabase = createServerClient();

  // Authenticate
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { newTask } = body as { newTask: ConsequenceInput["newTask"] };

  if (!newTask?.type || !newTask?.estimatedMinutes || !newTask?.deadlineDate) {
    return NextResponse.json({ error: "Missing newTask fields" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0]!;

  // Fetch data in parallel
  const [blocksRes, tasksRes, sessionsRes, profileRes] = await Promise.all([
    supabase.from("schedule_blocks").select("*").eq("user_id", user.id).gte("date", today),
    supabase.from("tasks").select("*").eq("user_id", user.id).neq("status", "cancelled"),
    supabase.from("time_sessions").select("*").eq("user_id", user.id).eq("is_valid", true),
    supabase.from("capacity_profiles").select("*").eq("user_id", user.id).single(),
  ]);

  if (blocksRes.error) return NextResponse.json({ error: blocksRes.error.message }, { status: 500 });
  if (tasksRes.error)  return NextResponse.json({ error: tasksRes.error.message },  { status: 500 });

  const profile = profileRes.data;
  const sessions: TimeSession[] = (sessionsRes.data ?? []).map(dbSessionToCore);
  const pev = computePEV(
    sessions,
    profile?.completed_task_count ?? 0,
    profile?.days_active ?? 0
  );

  // Build day capacities from today to deadline
  const days = buildDayCapacities(
    today,
    newTask.deadlineDate,
    profile?.weekday_minutes ?? 480,
    profile?.weekend_minutes ?? 120,
    blocksRes.data ?? []
  );

  const result = computeConsequence({
    newTask,
    existingBlocks: (blocksRes.data ?? []).map(dbBlockToCore),
    existingTasks: (tasksRes.data ?? []).map(dbTaskToCore),
    dayCapacities: days,
    pev,
    today,
  });

  return NextResponse.json(result);
}

// ─── DB row → core type mappers ───────────────────────────────────────────────

function dbTaskToCore(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    type: row.type as Task["type"],
    estimatedMinutes: row.estimated_minutes as number,
    deadlineDate: row.deadline_date as string,
    status: row.status as Task["status"],
    isFixed: row.is_fixed as boolean,
    isSoftDeadline: row.is_soft_deadline as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function dbBlockToCore(row: Record<string, unknown>): ScheduleBlock {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    userId: row.user_id as string,
    date: row.date as string,
    startMinute: row.start_minute as number,
    durationMinutes: row.duration_minutes as number,
    isFixed: row.is_fixed as boolean,
    rebalancePlanId: row.rebalance_plan_id as string | undefined,
  };
}

function dbSessionToCore(row: Record<string, unknown>): TimeSession {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    userId: row.user_id as string,
    date: row.date as string,
    estimatedMinutes: row.estimated_minutes as number,
    actualMinutes: row.actual_minutes as number,
    isValid: row.is_valid as boolean,
    completedAt: row.completed_at as string,
  };
}

function buildDayCapacities(
  from: string,
  to: string,
  weekdayMinutes: number,
  weekendMinutes: number,
  blocks: Record<string, unknown>[]
): DayCapacity[] {
  const blocksByDate = new Map<string, number>();
  for (const b of blocks) {
    const date = b.date as string;
    blocksByDate.set(date, (blocksByDate.get(date) ?? 0) + (b.duration_minutes as number));
  }

  const days: DayCapacity[] = [];
  const current = new Date(from);
  const end = new Date(to);

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0]!;
    const dow = current.getDay();
    const declared = dow === 0 || dow === 6 ? weekendMinutes : weekdayMinutes;
    const effective = Math.floor(declared * EFFECTIVE_CAPACITY_RATIO);

    days.push({
      date: dateStr,
      declaredMinutes: declared,
      effectiveMinutes: effective,
      scheduledMinutes: blocksByDate.get(dateStr) ?? 0,
      timeBankMinutes: 0, // fetched separately if needed
    });

    current.setDate(current.getDate() + 1);
  }

  return days;
}
