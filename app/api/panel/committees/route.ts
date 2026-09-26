import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { failure, json, protectMutation } from "@/lib/http";

export async function GET() {
  try {
    const staff = await requireStaff("admin");
    const { data, error } = await createAdminSupabase().from("committees")
      .select("id,name,active").eq("event_id", staff.eventId).order("name");
    if (error) throw error;
    return json({ items: data });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    const staff = await requireStaff("admin");
    const parsed = z.object({ name: z.string().trim().min(1).max(120) }).safeParse(await request.json());
    if (!parsed.success) return json({ error: "Komite adı gerekli." }, 400);
    const { data, error } = await createAdminSupabase().from("committees")
      .insert({ event_id: staff.eventId, name: parsed.data.name }).select("id,name,active").single();
    if (error?.code === "23505") return json({ error: "Komite zaten var." }, 409);
    if (error) throw error;
    return json(data, 201);
  } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    protectMutation(request);
    const staff = await requireStaff("admin");
    const parsed = z.object({ id: z.string().uuid(), active: z.boolean() }).safeParse(await request.json());
    if (!parsed.success) return json({ error: "Geçersiz komite." }, 400);
    const { data, error } = await createAdminSupabase().from("committees")
      .update({ active: parsed.data.active }).eq("event_id", staff.eventId).eq("id", parsed.data.id)
      .select("id,active").maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "Komite bulunamadı." }, 404);
    return json(data);
  } catch (error) { return failure(error); }
}
