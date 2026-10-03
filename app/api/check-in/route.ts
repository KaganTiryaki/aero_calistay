import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createServerSupabase } from "@/lib/supabase/server";
import { failure, json, protectMutation } from "@/lib/http";
import { startAdminActivity } from "@/lib/activity/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const staff = await requireStaff();
    const { data, error } = await createAdminSupabase().from("meal_sessions").select("id,name,opens_at,closes_at")
      .eq("event_id", staff.eventId).eq("active", true).maybeSingle();
    if (error) throw error;
    return json({ meal: data, role: staff.role, userId: staff.userId });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    const staff = await requireStaff();
    const parsed = z.object({ code: z.string().trim().min(8).max(80), requestId: z.string().uuid(), mealSessionId: z.string().uuid() })
      .safeParse(await request.json());
    if (!parsed.success) return json({ error: "Geçersiz kart kodu." }, 400);
    const finish = await startAdminActivity(request, staff, "check_in_attempt");
    const { data, error } = await (await createServerSupabase()).rpc("redeem_meal", {
      p_code: parsed.data.code, p_request_id: parsed.data.requestId, p_meal_session_id: parsed.data.mealSessionId,
    });
    if (error?.message.includes("RATE_LIMIT")) { await finish("denied", { details: { result: "rate_limit" } }); return json({ error: "Çok fazla deneme. Bir dakika bekleyin." }, 429); }
    if (error) throw error;
    const result = typeof data === "object" && data && "result" in data ? String(data.result) : "unknown";
    if (result === "rate_limited") { await finish("denied"); return json({ error: "Çok fazla deneme. Bir dakika bekleyin." }, 429); }
    await finish(result === "recorded" || result === "already" ? "succeeded" : "denied", { details: { result } });
    return json(data);
  } catch (error) { return failure(error); }
}
