import { NextRequest, NextResponse } from "next/server";
import { EFFECTIVE_CAPACITY_RATIO } from "@repo/core";
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

  // Ensure day_capacity row exists for the deadline date
  const today = new Date().toISOString().split("T")[0]!;
  const profile = await supabase
    .from("capacity_profiles")
    .select("weekday_minutes, weekend_minutes")
    .eq("user_id", user.id)
    .single();

  if (!profile.error && profile.data) {
    const deadline = new Date(deadlineDate);
    const dow = deadline.getDay();
    const declared = dow === 0 || dow === 6
      ? profile.data.weekend_minutes
      : profile.data.weekday_minutes;
    const effective = Math.floor(declared * EFFECTIVE_CAPACITY_RATIO);

    await supabase.from("day_capacities").upsert({
      user_id: user.id,
      date: deadlineDate,
      declared_minutes: declared,
      effective_minutes: effective,
      scheduled_minutes: 0,
      time_bank_minutes: 0,
    }, { onConflict: "user_id,date", ignoreDuplicates: true });
  }

  return NextResponse.json(task, { status: 201 });
}
