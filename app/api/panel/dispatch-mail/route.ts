import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { callMailWorker } from "@/lib/mail/dispatch";
import { summarizeMailJobs } from "@/lib/mail/status";
import { failure, json, protectMutation } from "@/lib/http";

export const maxDuration = 60;
const schema = z.object({ batchId: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    const staff = await requireStaff("admin");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Grup kimliği geçersiz." }, 400);
    const client = createAdminSupabase();
    const { data, error } = await client.from("mail_batches").select("id")
      .eq("id", parsed.data.batchId).eq("event_id", staff.eventId).maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "Gönderim grubu bulunamadı." }, 404);
    const health = await callMailWorker({ action: "health" });
    if (!health.ready) return json(health, 503);
    const result = await callMailWorker({ batchId: data.id, limit: 3 });
    const { data: states, error: statesError } = await client.from("mail_jobs")
      .select("status,delivery_status,last_error").eq("batch_id", data.id);
    if (statesError) throw statesError;
    return json({ ...result, ...summarizeMailJobs(states ?? []) }, result.ready ? 200 : 503);
  } catch (error) { return failure(error); }
}
