import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { validateApplication } from "@/lib/applications/validation";
import { failure, json, protectMutation } from "@/lib/http";

const applicationBody = z.object({ firstName: z.string(), lastName: z.string(), email: z.string() });
const updateBody = applicationBody.extend({ id: z.string().uuid(), version: z.number().int().positive() });

export async function GET(request: NextRequest) {
  try {
    const staff = await requireStaff("admin");
    const page = Math.max(1, Math.min(10000, Number(request.nextUrl.searchParams.get("page") || 1)));
    const rawSearch = request.nextUrl.searchParams.get("q")?.trim() || "";
    const search = rawSearch.replace(/[^\p{L}\p{N}@._+ -]/gu, "").slice(0, 80);
    const status = request.nextUrl.searchParams.get("status");
    let query = createAdminSupabase().from("applications").select("id,first_name,last_name,email,status,version,committee_id,created_at,approved_at", { count: "exact" })
      .eq("event_id", staff.eventId).order("created_at", { ascending: false }).range((page - 1) * 50, page * 50 - 1);
    if (status && ["pending", "approval_queued", "approved", "cancelled"].includes(status)) query = query.eq("status", status);
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, count, error } = await query;
    if (error) throw error;
    return json({ items: data, total: count ?? 0, page });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    const staff = await requireStaff("admin");
    const parsed = applicationBody.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Geçersiz başvuru." }, 400);
    const input = validateApplication(parsed.data);
    const client = createAdminSupabase();
    const { data, error } = await client.from("applications").insert({
      event_id: staff.eventId, first_name: input.firstName, last_name: input.lastName,
      email: input.email, created_by: staff.userId,
    }).select("id,first_name,last_name,email,status,version").single();
    if (error?.code === "23505") return json({ error: "Bu e-posta zaten kayıtlı." }, 409);
    if (error) throw error;
    return json(data, 201);
  } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    protectMutation(request);
    const staff = await requireStaff("admin");
    const parsed = updateBody.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Geçersiz başvuru." }, 400);
    const input = validateApplication(parsed.data);
    const { data, error } = await createAdminSupabase().from("applications")
      .update({ first_name: input.firstName, last_name: input.lastName, email: input.email,
        version: parsed.data.version + 1, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.id).eq("event_id", staff.eventId).eq("version", parsed.data.version)
      .eq("status", "pending").select("id,version").maybeSingle();
    if (error?.code === "23505") return json({ error: "Bu e-posta zaten kayıtlı." }, 409);
    if (error) throw error;
    if (!data) return json({ error: "Kayıt değişti; listeyi yenileyin." }, 409);
    return json(data);
  } catch (error) { return failure(error); }
}
