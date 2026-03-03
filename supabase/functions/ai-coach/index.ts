import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // --- Auth check ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const sessions = Array.isArray(body?.sessions) ? body.sessions : [];
    const plan = body?.plan && typeof body.plan === "object" ? body.plan : {};

    // Validate and cap sessions to prevent oversized payloads
    if (sessions.length > 500) {
      return new Response(
        JSON.stringify({ error: "Too many sessions (max 500)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build a compact summary with validated/sanitized fields
    const sessionSummary = sessions.slice(0, 500).map((s: any) => ({
      date: typeof s.session_date === "string" ? s.session_date.slice(0, 10) : "",
      type: typeof s.session_type === "string" ? s.session_type.slice(0, 50) : "",
      title: typeof s.title === "string" ? s.title.slice(0, 200) : "",
      completed: Boolean(s.completed),
      target: typeof s.primary_target === "string" ? s.primary_target.slice(0, 50) : "",
    }));

    const systemPrompt = `You are an elite endurance coach specializing in Spartan Ultra race preparation. You analyze training plans and provide actionable coaching advice.

Given the athlete's training plan data, analyze:
1. **Training Load & Progression** — Is volume building appropriately? Any sudden spikes?
2. **Recovery Patterns** — Are easy/recovery days well-placed after hard sessions? Is there adequate rest?
3. **Session Balance** — Good mix of easy, interval, tempo, long, and strength sessions?
4. **Compliance** — How well is the athlete sticking to the plan? Any patterns in missed sessions?
5. **Race Readiness** — Based on progress, are they on track for the race date?

Provide 3-5 specific, actionable recommendations. Be direct, motivating, and use a military-inspired coaching tone consistent with the Spartan brand. Use markdown formatting with headers and bullet points.`;

    // Sanitize plan fields
    const safePlanName = typeof plan.plan_name === "string" ? plan.plan_name.slice(0, 200) : "Spartan Ultra Plan";
    const safePlanStatus = typeof plan.status === "string" ? plan.status.slice(0, 50) : "unknown";
    const safePlanStart = typeof plan.start_date === "string" ? plan.start_date.slice(0, 10) : "?";
    const safePlanEnd = typeof plan.end_date === "string" ? plan.end_date.slice(0, 10) : "?";

    const userMessage = `Here is my training plan data:

**Plan:** ${safePlanName}
**Status:** ${safePlanStatus}
**Period:** ${safePlanStart} → ${safePlanEnd}

**Sessions (${sessionSummary.length} total):**
${JSON.stringify(sessionSummary, null, 2)}

Analyze my training and give me coaching recommendations.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await response.text();
      console.error("AI gateway error:", { status: response.status });
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-coach error:", { message: e instanceof Error ? e.message : "Unknown error" });
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
