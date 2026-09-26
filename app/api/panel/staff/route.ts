import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { failure, json, protectMutation } from "@/lib/http";

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
    const parsed = z.object({ email: z.string().email(), role: z.enum(["admin", "staff"]) })
      .safeParse(await request.json());
    if (!parsed.success) return json({ error: "Geçersiz personel." }, 400);
    const client = createAdminSupabase();
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin}/auth/callback?next=${encodeURIComponent("/giris?recovery=1")}`;
    const { data: invited, error: inviteError } = await client.auth.admin.inviteUserByEmail(parsed.data.email, { redirectTo });
    let user = invited.user;
    let invitationSent = !inviteError && Boolean(user);
    if (!user) {
      const email = parsed.data.email.trim().toLowerCase();
      for (let page = 1; page <= 100; page++) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        user = data.users.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;
        if (user || data.users.length < 200) break;
      }
      if (!user) throw inviteError ?? new Error("Davet oluşturulamadı.");
      invitationSent = false;
    }
    const { data: existing, error: existingError } = await client.from("staff_members")
      .select("user_id").eq("user_id", user.id).eq("event_id", staff.eventId).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return json({ error: "Bu hesap zaten personel." }, 409);
    const { error } = await client.from("staff_members").insert({
      user_id: user.id, event_id: staff.eventId, role: parsed.data.role, active: true,
    });
    if (error) throw error;
    return json({ userId: user.id, invitationSent }, 201);
  } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    protectMutation(request);
    const staff = await requireStaff("admin");
    const parsed = z.object({ userId: z.string().uuid(), active: z.boolean() }).safeParse(await request.json());
    if (!parsed.success || parsed.data.userId === staff.userId) return json({ error: "Geçersiz personel." }, 400);
    const { data, error } = await createAdminSupabase().from("staff_members")
      .update({ active: parsed.data.active }).eq("event_id", staff.eventId).eq("user_id", parsed.data.userId)
      .select("user_id,active").maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "Personel bulunamadı." }, 404);
    return json(data);
  } catch (error) { return failure(error); }
}
