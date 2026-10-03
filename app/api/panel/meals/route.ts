import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { json, protectMutation } from "@/lib/http";
import { participantFailure } from "@/lib/participant/server";
export async function GET() {
  try {
    const staff = await requireStaff("admin"); const { data, error } = await createAdminSupabase().from("meal_sessions")
      .select("id,name,opens_at,closes_at,active").eq("event_id", staff.eventId).order("opens_at", { ascending: false }).limit(100);
    if (error) throw error; return json({ items: data });
  } catch (error) { return participantFailure(error); }
}
export async function POST(request: NextRequest) {
  try {
    protectMutation(request); const staff = await requireStaff("admin");
    const parsed = z.object({ name: z.string().trim().min(1).max(100), opensAt: z.string().datetime({ offset: true }), closesAt: z.string().datetime({ offset: true }) }).safeParse(await request.json());
    if (!parsed.success || Date.parse(parsed.data.closesAt) <= Date.parse(parsed.data.opensAt)) return json({ error: "Öğün adı ve saatlerini kontrol edin." }, 400);
    const { error } = await createAdminSupabase().from("meal_sessions").insert({ event_id: staff.eventId, name: parsed.data.name, opens_at: parsed.data.opensAt, closes_at: parsed.data.closesAt });
    if (error) throw error; return json({ ok: true }, 201);
  } catch (error) { return participantFailure(error); }
}
export async function PATCH(request: NextRequest) {
  try {
    protectMutation(request); const staff = await requireStaff("admin");
    const parsed = z.object({ id: z.string().uuid(), active: z.boolean() }).safeParse(await request.json());
    if (!parsed.success) return json({ error: "Geçersiz öğün." }, 400);
    const { data, error } = await createAdminSupabase().from("meal_sessions").update({ active: parsed.data.active }).eq("id", parsed.data.id).eq("event_id", staff.eventId).select("id").maybeSingle();
    if (error) throw error; if (!data) throw new Error("FORBIDDEN"); return json({ ok: true });
  } catch (error) { return participantFailure(error); }
}
