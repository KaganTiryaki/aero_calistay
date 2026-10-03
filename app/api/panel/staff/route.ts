import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { failure, json, protectMutation } from "@/lib/http";
import { startAdminActivity } from "@/lib/activity/server";

export async function GET() {
  try {
    const staff = await requireStaff("admin");
    const client = createAdminSupabase();
    const { data, error } = await client.from("staff_members")
      .select("user_id,role,active,created_at").eq("event_id", staff.eventId).order("created_at");
    if (error) throw error;
    const items = await Promise.all((data ?? []).map(async (item) => {
      const { data: user, error: userError } = await client.auth.admin.getUserById(item.user_id);
      if (userError) throw userError;
      return { ...item, email: user.user.email ?? null };
    }));
    return json({ items });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    const staff = await requireStaff("admin");
    const parsed = z.object({ email: z.email().max(254) }).safeParse(await request.json());
    if (!parsed.success) return json({ error: "Geçerli personel e-postası girin." }, 400);
    const email = parsed.data.email.trim().toLowerCase();
    const client = createAdminSupabase();
    const { data: existingId, error: lookupError } = await client.rpc("find_auth_user_by_email", { p_email: email });
    if (lookupError) throw lookupError;
    let userId: string = existingId;
    if(userId === staff.userId)return json({error:"Yönetici hesabı personel davetiyle değiştirilemez."},409);
    if (!userId) {
      const origin = new URL(request.url).origin;
      const { data, error } = await client.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/personel/aktivasyon` });
      if (error || !data.user) throw error ?? new Error("INVITE_FAILED");
      userId = data.user.id;
    }
    const { error } = await (await createServerSupabase()).rpc("register_event_staff",{p_user_id:userId,p_event_id:staff.eventId});
    if(error?.message?.includes("ADMIN_ROLE_PROTECTED"))return json({error:"Mevcut yönetici rolü personel davetiyle değiştirilemez."},409);
    if (error) throw error;
    return json({ ok: true, invited: !existingId });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    protectMutation(request);
    const staff = await requireStaff("admin");
    const parsed = z.object({ userId: z.string().uuid(), active: z.boolean() }).safeParse(await request.json());
    if (!parsed.success || parsed.data.userId === staff.userId) return json({ error: "Geçersiz personel." }, 400);
    const finish = await startAdminActivity(request, staff, "account_access_change", parsed.data.userId,
      { active: parsed.data.active });
    const { data, error } = await createAdminSupabase().from("staff_members")
      .update({ active: parsed.data.active }).eq("event_id", staff.eventId).eq("user_id", parsed.data.userId)
      .select("user_id,active").maybeSingle();
    if (error) throw error;
    if (!data) { await finish("denied"); return json({ error: "Personel bulunamadı." }, 404); }
    await finish("succeeded");
    return json(data);
  } catch (error) { return failure(error); }
}
