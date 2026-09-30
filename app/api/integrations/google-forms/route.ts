import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { normalizeEmail, validateApplication } from "@/lib/applications/validation";

const bodySchema = z.object({ firstName: z.string(), lastName: z.string(), email: z.string() });

export async function POST(request: NextRequest) {
  const expected = process.env.GOOGLE_FORMS_WEBHOOK_SECRET;
  if (!expected || request.headers.get("x-aero-webhook-secret") !== expected) {
    return Response.json({ error: "Yetkisiz webhook isteği." }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Geçersiz başvuru verisi." }, { status: 400 });
  try {
    const input = validateApplication(parsed.data);
    const client = createAdminSupabase();
    const { data: event, error: eventError } = await client.from("events").select("id").limit(1).single();
    if (eventError) throw eventError;
    const { data, error } = await client.from("applications").insert({
      event_id: event.id, first_name: input.firstName, last_name: input.lastName,
      email: normalizeEmail(input.email),
    }).select("id, status").single();
    if (error?.code === "23505") return Response.json({ ok: true, duplicate: true });
    if (error) throw error;
    return Response.json({ ok: true, applicationId: data.id, status: data.status }, { status: 201 });
  } catch (error) {
    console.error("Google Forms webhook failed", error);
    return Response.json({ error: "Başvuru kaydedilemedi." }, { status: 500 });
  }
}
