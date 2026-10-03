import { participantGate } from "@/lib/participant/gates";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createServerSupabase } from "@/lib/supabase/server";
import { failure, json, protectMutation } from "@/lib/http";
import { startAdminActivity } from "@/lib/activity/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    protectMutation(request); const disabled=participantGate("acceptance");if(disabled)return disabled;
    const staff = await requireStaff("admin");
    const parsed = z.object({ jobId: z.string().uuid(), email: z.email().optional() }).safeParse(await request.json());
    if (!parsed.success) return json({ error: "Geçersiz gönderim." }, 400);
    const finish = await startAdminActivity(request, staff, "approval_retry", parsed.data.jobId);
    const { data: job, error: jobError } = await createAdminSupabase().from("mail_jobs").select("kind,recipient_email,application_id")
      .eq("id", parsed.data.jobId).maybeSingle();
    if (jobError) throw jobError;
    if (!job) return json({ error: "Gönderim bulunamadı." }, 404);
    const { data: app } = await createAdminSupabase().from("applications").select("id").eq("id", job.application_id).eq("event_id", staff.eventId).maybeSingle();
    if (!app) return json({ error: "Gönderim bulunamadı." }, 404);
    const { data, error } = job.kind === "acceptance" || job.kind === "participant_auth"
      ? await (await createServerSupabase()).rpc("retry_participant_invite", { p_job_id: parsed.data.jobId, p_email: parsed.data.email ?? job.recipient_email })
      : await (await createServerSupabase()).rpc("reopen_failed_approval", { p_job_id: parsed.data.jobId });
    if (error) throw error;
    if (!data) { await finish("denied"); return json({ error: "Bu gönderim yeniden açılamadı." }, 409); }
    await finish("succeeded");
    return json({ completed: true });
  } catch (error) { return failure(error); }
}
