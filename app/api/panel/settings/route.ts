import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { failure, json, protectMutation } from "@/lib/http";

export async function GET() {
  try {
    const staff = await requireStaff("admin");
    const client = createAdminSupabase();
    const [{ data: event, error }, { data: provider }] = await Promise.all([
      client.from("events").select("id,name,check_in_open,timezone").eq("id", staff.eventId).single(),
      client.from("mail_provider_state").select("approval_budget,auth_reserve,reserved_today,worker_heartbeat_at,reconciliation_heartbeat_at").eq("id", 1).single(),
    ]);
    if (error) throw error;
    return json({ event, provider });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    protectMutation(request);
    const staff = await requireStaff("admin");
    const parsed = z.object({ checkInOpen: z.boolean() }).safeParse(await request.json());
    if (!parsed.success) return json({ error: "Geçersiz ayar." }, 400);
    const { data, error } = await createAdminSupabase().from("events")
      .update({ check_in_open: parsed.data.checkInOpen }).eq("id", staff.eventId)
      .select("check_in_open").single();
    if (error) throw error;
    return json(data);
  } catch (error) { return failure(error); }
}
