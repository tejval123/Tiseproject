import { NextRequest, NextResponse } from "next/server";
import { EFFECTIVE_CAPACITY_RATIO, COMPLEXITY_MULTIPLIER, DEFAULT_PEV } from "@repo/core";
import type { TaskType } from "@repo/core";
import { createServerClient } from "../../../lib/supabase";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error: dbError } = await supabase
    .from("tasks")
    .select("*, schedule_blocks(*)")
    .eq("user_id", user.id)
    .neq("status", "cancelled")
    .order("deadline_date", { ascending: true });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, type, estimatedMinutes, deadlineDate, isFixed, isSoftDeadline } = body;

  if (!title || !type || !estimatedMinutes || !deadlineDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Insert task
  const { data: task, error: insertError } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title,
      type,
      estimated_minutes: estimatedMinutes,
      deadline_date: deadlineDate,
      is_fixed: isFixed ?? false,
      is_soft_deadline: isSoftDeadline ?? false,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const today = new Date().toISOString().split("T")[0]!;
  const profile = await supabase
    .from("capacity_profiles")
    .select("weekday_minutes, weekend_minutes, preferred_start_minute")
    .eq("user_id", user.id)
    .single();

  if (!profile.error && profile.data) {
    // Compute adjusted effort for block duration
    const cm = COMPLEXITY_MULTIPLIER[type as TaskType] ?? COMPLEXITY_MULTIPLIER.unknown;
    const blockDuration = Math.ceil(estimatedMinutes * cm * DEFAULT_PEV);

    // Find the best day to place the block: earliest day with enough capacity
    const placementDate = await findPlacementDate(
      supabase, user.id, today, deadlineDate, blockDuration, profile.data
    );

    // Get existing blocks on the target day to find next available start minute
    const { data: existingBlocks } = await supabase
      .from("schedule_blocks")
      .select("start_minute, duration_minutes")
      .eq("user_id", user.id)
      .eq("date", placementDate)
      .order("start_minute", { ascending: true });

    let startMinute = profile.data.preferred_start_minute ?? 540;
    if (existingBlocks && existingBlocks.length > 0) {
      const lastBlock = existingBlocks[existingBlocks.length - 1]!;
      startMinute = lastBlock.start_minute + lastBlock.duration_minutes;
    }

    // Create the schedule block
    await supabase.from("schedule_blocks").insert({
      task_id: task.id,
      user_id: user.id,
      date: placementDate,
      start_minute: startMinute,
      duration_minutes: blockDuration,
      is_fixed: isFixed ?? false,
    });

    // Ensure day_capacity rows exist and update scheduled_minutes
    const placementDow = new Date(placementDate).getDay();
    const declared = placementDow === 0 || placementDow === 6
      ? profile.data.weekend_minutes
      : profile.data.weekday_minutes;
    const effective = Math.floor(declared * EFFECTIVE_CAPACITY_RATIO);

    // Upsert day_capacity, then increment scheduled_minutes
    await supabase.from("day_capacities").upsert({
      user_id: user.id,
      date: placementDate,
      declared_minutes: declared,
      effective_minutes: effective,
      scheduled_minutes: blockDuration,
      time_bank_minutes: 0,
    }, { onConflict: "user_id,date", ignoreDuplicates: true });

    // If the row already existed, add to scheduled_minutes
    await supabase.rpc("add_scheduled_minutes", {
      uid: user.id,
      target_date: placementDate,
      minutes_to_add: blockDuration,
    }).catch(() => {
      // RPC may not exist yet — non-critical, day_capacities insert above covers new rows
    });
  }

  return NextResponse.json(task, { status: 201 });
}

// Find the earliest day between today and deadline that has enough capacity
async function findPlacementDate(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  today: string,
  deadline: string,
  needed: number,
  profile: { weekday_minutes: number; weekend_minutes: number }
): Promise<string> {
  // Fetch existing scheduled minutes per day
  const { data: blocks } = await supabase
    .from("schedule_blocks")
    .select("date, duration_minutes")
    .eq("user_id", userId)
    .gte("date", today)
    .lte("date", deadline);

  const scheduledByDate = new Map<string, number>();
  for (const b of blocks ?? []) {
    scheduledByDate.set(b.date, (scheduledByDate.get(b.date) ?? 0) + b.duration_minutes);
  }

  const current = new Date(today);
  const end = new Date(deadline);

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0]!;
    const dow = current.getDay();
    const declared = dow === 0 || dow === 6 ? profile.weekend_minutes : profile.weekday_minutes;
    const effective = Math.floor(declared * EFFECTIVE_CAPACITY_RATIO);
    const scheduled = scheduledByDate.get(dateStr) ?? 0;

    if (effective - scheduled >= needed) {
      return dateStr;
    }
    current.setDate(current.getDate() + 1);
  }

  // Fallback: place on deadline date even if overloaded
  return deadline;
}
