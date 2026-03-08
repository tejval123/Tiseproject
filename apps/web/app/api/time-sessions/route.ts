import { NextRequest, NextResponse } from "next/server";
import { depositTimeBank, withdrawTimeBank } from "@repo/core";
import { createServerClient } from "../../../lib/supabase";

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { taskId, estimatedMinutes, actualMinutes } = body;

  if (!taskId || estimatedMinutes == null || actualMinutes == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0]!;
  const isValid = actualMinutes >= 5;

  // Insert session
  const { data: session, error: sessionError } = await supabase
    .from("time_sessions")
    .insert({
      task_id: taskId,
      user_id: user.id,
      date: today,
      estimated_minutes: estimatedMinutes,
      actual_minutes: actualMinutes,
      is_valid: isValid,
    })
    .select()
    .single();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

  // Fetch current time bank balance
  const { data: bankRow } = await supabase
    .from("time_bank")
    .select("balance_minutes")
    .eq("user_id", user.id)
    .eq("date", today)
    .single();

  const currentBank = { userId: user.id, date: today, balanceMinutes: bankRow?.balance_minutes ?? 0 };
  let bankMessage = "";
  let overflow = 0;

  if (actualMinutes < estimatedMinutes && isValid) {
    const result = depositTimeBank(currentBank, actualMinutes, estimatedMinutes);
    bankMessage = result.message;
    await supabase.from("time_bank").upsert({
      user_id: user.id,
      date: today,
      balance_minutes: result.newBalance,
    }, { onConflict: "user_id,date" });
  } else if (actualMinutes > estimatedMinutes) {
    const result = withdrawTimeBank(currentBank, actualMinutes, estimatedMinutes);
    bankMessage = result.message;
    overflow = result.overflow;
    await supabase.from("time_bank").upsert({
      user_id: user.id,
      date: today,
      balance_minutes: result.newBalance,
    }, { onConflict: "user_id,date" });
  }

  // Update profile session count
  await supabase.rpc("increment_session_count", { uid: user.id });

  return NextResponse.json({
    session,
    bankMessage,
    slipDetectionNeeded: overflow > 0,
    overflowMinutes: overflow,
  });
}
