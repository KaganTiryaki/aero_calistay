import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { json, protectMutation } from "@/lib/http";
import { participantFailure } from "@/lib/participant/server";
export async function GET() {
  try {
    const staff = await requireStaff("admin");
    const { data, error } = await createAdminSupabase().from("events").select("payment_iban,payment_deadline,participant_portal_url").eq("id", staff.eventId).single();
    if (error) throw error; return json(data);
  } catch (error) { return participantFailure(error); }
}
export async function PATCH(request: NextRequest) {
  try {
    protectMutation(request); const staff = await requireStaff("admin");
    const schema = z.object({ iban: z.string().transform((value) => value.replace(/\s/g, "").toUpperCase()).pipe(z.string().regex(/^TR\d{24}$/)).nullable(),
      deadline: z.string().datetime({ offset: true }).nullable(), portalUrl: z.string().url().regex(/^https:\/\/[^ /?#]+\/katilimci$/) });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return json({ error: "IBAN, son tarih ve HTTPS katılımcı adresini kontrol edin." }, 400);
    if (parsed.data.deadline && new Date(parsed.data.deadline).getTime() <= Date.now()) return json({ error: "Son ödeme tarihi gelecekte olmalı." }, 400);
    const { error } = await createAdminSupabase().from("events").update({ payment_iban: parsed.data.iban,
      payment_deadline: parsed.data.deadline, participant_portal_url: parsed.data.portalUrl }).eq("id", staff.eventId);
    if (error) throw error; return json({ ok: true });
  } catch (error) { return participantFailure(error); }
}
