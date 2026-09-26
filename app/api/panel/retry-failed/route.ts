import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createServerSupabase } from "@/lib/supabase/server";
import { failure, json, protectMutation } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    await requireStaff("admin");
    const parsed = z.object({ jobId: z.string().uuid() }).safeParse(await request.json());
    if (!parsed.success) return json({ error: "Geçersiz gönderim." }, 400);
    const { data, error } = await (await createServerSupabase()).rpc("reopen_failed_approval", {
      p_job_id: parsed.data.jobId,
    });
    if (error) throw error;
    if (!data) return json({ error: "Bu gönderim yeniden açılamadı." }, 409);
    return json({ completed: true });
  } catch (error) { return failure(error); }
}
