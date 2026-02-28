import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function secPerKmToDisplay(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function secondsToDisplay(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const remainder = sec % 60;
  if (remainder === 0) return `${mins}min`;
  return `${mins}min ${remainder}s`;
}

function metersToDisplay(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${m}m`;
}

function formatSessionsToJSON(sessions: any[]): string {
  const data = {
    exportedAt: new Date().toISOString(),
    format: "spartan-trainer-v1",
    sessions: sessions.map((s: any) => ({
      date: s.session_date,
      title: s.title,
      type: s.session_type,
      primaryTarget: s.primary_target,
      notes: s.notes,
      steps: (s.steps || []).map((st: any) => ({
        order: st.step_order,
        type: st.step_type,
        duration: {
          type: st.duration_type,
          value: st.duration_value,
          display:
            st.duration_type === "time"
              ? secondsToDisplay(st.duration_value)
              : metersToDisplay(st.duration_value),
        },
        paceTarget: st.target_pace_low_sec_per_km
          ? {
              low: secPerKmToDisplay(st.target_pace_low_sec_per_km),
              high: st.target_pace_high_sec_per_km
                ? secPerKmToDisplay(st.target_pace_high_sec_per_km)
                : null,
              lowSec: st.target_pace_low_sec_per_km,
              highSec: st.target_pace_high_sec_per_km,
            }
          : null,
        hrTarget: st.target_hr_low_bpm
          ? { low: st.target_hr_low_bpm, high: st.target_hr_high_bpm }
          : null,
        notes: st.step_notes,
      })),
    })),
  };
  return JSON.stringify(data, null, 2);
}

function formatSessionsToFITStub(sessions: any[]): string {
  const fitWorkouts = sessions.map((s: any) => ({
    fileType: "WORKOUT",
    workoutName: `${s.session_date}_${s.title.replace(/\s+/g, "_")}`,
    sport: "RUNNING",
    subSport: s.session_type === "interval" ? "TRACK" : "STREET",
    numValidSteps: (s.steps || []).length,
    steps: (s.steps || []).map((st: any) => ({
      messageIndex: st.step_order,
      workoutStepName: st.step_notes || st.step_type,
      durationType: st.duration_type === "time" ? "TIME" : "DISTANCE",
      durationValue:
        st.duration_type === "time"
          ? st.duration_value * 1000
          : st.duration_value * 100,
      targetType: st.target_pace_low_sec_per_km
        ? "SPEED"
        : st.target_hr_low_bpm
        ? "HEART_RATE"
        : "OPEN",
      targetValue: 0,
      customTargetLow: st.target_pace_low_sec_per_km
        ? Math.round((1000 / st.target_pace_high_sec_per_km!) * 1000)
        : st.target_hr_low_bpm || 0,
      customTargetHigh: st.target_pace_high_sec_per_km
        ? Math.round((1000 / st.target_pace_low_sec_per_km!) * 1000)
        : st.target_hr_high_bpm || 0,
      intensity:
        st.step_type === "warmup" || st.step_type === "cooldown"
          ? "WARMUP"
          : st.step_type === "recover"
          ? "REST"
          : "ACTIVE",
    })),
  }));
  return JSON.stringify(fitWorkouts, null, 2);
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const { planId, range, exportType } = await req.json();

    if (!planId) {
      return new Response(
        JSON.stringify({ error: "planId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user owns the plan
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, plan_name")
      .eq("id", planId)
      .eq("user_id", userId)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: "Plan not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate date range
    const today = new Date();
    const daysAhead = range === "month" ? 30 : 7;
    const rangeEnd = new Date(today);
    rangeEnd.setDate(rangeEnd.getDate() + daysAhead);

    const rangeStartStr = today.toISOString().split("T")[0];
    const rangeEndStr = rangeEnd.toISOString().split("T")[0];

    // Fetch sessions in range
    const { data: sessions, error: sessError } = await supabase
      .from("sessions")
      .select("*")
      .eq("plan_id", planId)
      .gte("session_date", rangeStartStr)
      .lte("session_date", rangeEndStr)
      .order("session_date", { ascending: true });

    if (sessError) throw sessError;

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No sessions in the selected range" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch steps for all sessions
    const sessionIds = sessions.map((s: any) => s.id);
    const { data: allSteps, error: stepsError } = await supabase
      .from("session_steps")
      .select("*")
      .in("session_id", sessionIds)
      .order("step_order", { ascending: true });

    if (stepsError) throw stepsError;

    // Attach steps to sessions
    const sessionsWithSteps = sessions.map((s: any) => ({
      ...s,
      steps: (allSteps || []).filter((st: any) => st.session_id === s.id),
    }));

    // Generate export content
    const type = exportType === "fit" ? "fit" : "json";
    const content =
      type === "json"
        ? formatSessionsToJSON(sessionsWithSteps)
        : formatSessionsToFITStub(sessionsWithSteps);

    // Log export job
    await supabase.from("export_jobs").insert({
      user_id: userId,
      plan_id: planId,
      range_start: rangeStartStr,
      range_end: rangeEndStr,
      export_type: type === "json" ? "JSON" : "FIT",
      status: "done",
    });

    const rangeLabel = range === "month" ? "month" : "week";
    const filename =
      type === "json"
        ? `spartan-plan-${rangeLabel}-${rangeStartStr}.json`
        : `spartan-workouts-${rangeLabel}-${rangeStartStr}.fit.json`;

    return new Response(content, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("export-workouts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
