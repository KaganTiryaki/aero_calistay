import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { callMailWorker } from "@/lib/mail/dispatch";
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
    const result = await callMailWorker({ batchId: data.id, limit: 20 });
    return json(result, result.ready ? 200 : 503);
  } catch (error) { return failure(error); }
}
