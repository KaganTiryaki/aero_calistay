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
    const parsed = z.object({ id: z.string().uuid(), action: z.enum(["cancel", "rotateQr"]) })
      .safeParse(await request.json());
    if (!parsed.success) return json({ error: "Geçersiz işlem." }, 400);
    const rpc = parsed.data.action === "cancel" ? "cancel_application" : "rotate_qr";
    const finish = await startAdminActivity(request, staff,
      parsed.data.action === "cancel" ? "application_cancel" : "qr_rotate", parsed.data.id);
    const { data, error } = await (await createServerSupabase()).rpc(rpc, { p_application_id: parsed.data.id });
    if (error) throw error;
    await finish(data ? "succeeded" : "denied");
    return json({ completed: data });
  } catch (error) { return failure(error); }
}
