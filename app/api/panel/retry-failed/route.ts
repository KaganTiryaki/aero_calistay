import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createServerSupabase } from "@/lib/supabase/server";
import { failure, json, protectMutation } from "@/lib/http";
import { startAdminActivity } from "@/lib/activity/server";

export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    const staff = await requireStaff("admin");
    const parsed = z.object({ jobId: z.string().uuid() }).safeParse(await request.json());
    if (!parsed.success) return json({ error: "Geçersiz gönderim." }, 400);
    const finish = await startAdminActivity(request, staff, "approval_retry", parsed.data.jobId);
    const { data, error } = await (await createServerSupabase()).rpc("reopen_failed_approval", {
      p_job_id: parsed.data.jobId,
    });
    if (error) throw error;
    if (!data) { await finish("denied"); return json({ error: "Bu gönderim yeniden açılamadı." }, 409); }
    await finish("succeeded");
    return json({ completed: true });
  } catch (error) { return failure(error); }
}
