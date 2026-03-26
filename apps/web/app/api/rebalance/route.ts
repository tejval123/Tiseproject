import { NextRequest, NextResponse } from "next/server";
import {
  computeSlipScore,
  runRebalance,
  SlipInput,
  ScheduleBlock,
  Task,
  DayCapacity,
  EFFECTIVE_CAPACITY_RATIO,
} from "@repo/core";
import { createServerClient } from "../../../lib/supabase";

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const slipInput: SlipInput = body.slipInput;

  if (!slipInput) return NextResponse.json({ error: "Missing slipInput" }, { status: 400 });

  const slipScore = computeSlipScore(slipInput);

  if (slipScore.level === 1) {
    // Level 1: just use Time Bank, no rebalance needed
    return NextResponse.json({ slipScore, plan: null, message: "Local repair via Time Bank" });
  }

  const today = new Date().toISOString().split("T")[0]!;
  const now = new Date();
  const nowMinute = now.getHours() * 60 + now.getMinutes();

  const [blocksRes, tasksRes, profileRes, bankRes] = await Promise.all([
    supabase.from("schedule_blocks").select("*").eq("user_id", user.id).gte("date", today),
    supabase.from("tasks").select("*").eq("user_id", user.id).not("status", "in", '("completed","cancelled")'),
    supabase.from("capacity_profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("time_bank").select("date, balance_minutes").eq("user_id", user.id).gte("date", today),
  ]);

  const profile = profileRes.data;
  const blocks: ScheduleBlock[] = (blocksRes.data ?? []).map(dbBlockToCore);
  const tasks: Task[] = (tasksRes.data ?? []).map(dbTaskToCore);

  const horizonEnd = addDays(today, slipScore.level === 3 ? 14 : 3);
  const dayCapacities = buildDayCapacities(
    today,
    horizonEnd,
    profile?.weekday_minutes ?? 480,
    profile?.weekend_minutes ?? 120,
    blocksRes.data ?? [],
    bankRes.data ?? []
  );

  const plan = runRebalance({
    slipLevel: slipScore.level,
    blocks,
    tasks,
    dayCapacities,
    today,
    nowMinute,
  });

  // Persist plan (moves applied on accept, not here)
  const { data: saved, error: saveError } = await supabase
    .from("rebalance_plans")
    .insert({
      id: plan.id,
      user_id: user.id,
      triggered_at: plan.triggeredAt,
      slip_level: plan.slipLevel,
      moves: plan.moves,
      accepted: false,
    })
    .select()
    .single();

  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

  return NextResponse.json({ slipScore, plan: saved });
}

// Accept a rebalance plan — apply the block moves
export async function PATCH(req: NextRequest) {
  const supabase = createServerClient();
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await req.json();

  const { data: plan, error: fetchError } = await supabase
    .from("rebalance_plans")
    .select("*")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const moves = plan.moves as Array<{
    blockId: string;
    after: { date: string; startMinute: number };
  }>;

  // Apply each move
  const updates = moves.map((move) =>
    supabase
      .from("schedule_blocks")
      .update({ date: move.after.date, start_minute: move.after.startMinute, rebalance_plan_id: planId })
      .eq("id", move.blockId)
      .eq("user_id", user.id)
  );

  await Promise.all(updates);
  await supabase.from("rebalance_plans").update({ accepted: true }).eq("id", planId);

  return NextResponse.json({ accepted: true, planId });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function buildDayCapacities(
  from: string,
  to: string,
  weekdayMinutes: number,
  weekendMinutes: number,
  blocks: Record<string, unknown>[],
  bankRows: Record<string, unknown>[] = []
): DayCapacity[] {
  const blocksByDate = new Map<string, number>();
  for (const b of blocks) {
    const date = b.date as string;
    blocksByDate.set(date, (blocksByDate.get(date) ?? 0) + (b.duration_minutes as number));
  }

  const bankByDate = new Map<string, number>();
  for (const b of bankRows) {
    bankByDate.set(b.date as string, b.balance_minutes as number);
  }

  const days: DayCapacity[] = [];
  const current = new Date(from);
  const end = new Date(to);

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0]!;
    const dow = current.getDay();
    const declared = dow === 0 || dow === 6 ? weekendMinutes : weekdayMinutes;
    days.push({
      date: dateStr,
      declaredMinutes: declared,
      effectiveMinutes: Math.floor(declared * EFFECTIVE_CAPACITY_RATIO),
      scheduledMinutes: blocksByDate.get(dateStr) ?? 0,
      timeBankMinutes: bankByDate.get(dateStr) ?? 0,
    });
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0]!;
}
