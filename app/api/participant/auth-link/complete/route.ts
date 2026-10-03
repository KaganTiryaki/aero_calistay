import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { json, protectMutation } from "@/lib/http";
import { participantFailure } from "@/lib/participant/server";

const schema = z.object({ tokenHash: z.string().min(16).max(512), type: z.enum(["invite", "magiclink", "recovery"]) });
export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Bağlantı kullanılamadı veya süresi doldu." }, 400);
    const server = await createServerSupabase();
    const verified = await server.auth.verifyOtp({ token_hash: parsed.data.tokenHash, type: parsed.data.type });
    if (verified.error || !verified.data.user?.email_confirmed_at) return json({ error: "Bağlantı kullanılamadı veya süresi doldu." }, 400);
    const admin = createAdminSupabase();
    const { data: membership, error } = await admin.from("participant_memberships").select("application_id").eq("user_id", verified.data.user.id).maybeSingle();
    if (error) throw error;
    if (membership) {
      const { data: app, error: appError } = await admin.from("applications").select("email,status").eq("id", membership.application_id).single();
      if (appError || app.email.toLowerCase() !== verified.data.user.email?.toLowerCase() || !["accepted_pending_payment", "confirmed"].includes(app.status))
        return json({ error: "Bağlantı kullanılamadı veya süresi doldu." }, 403);
    } else if (parsed.data.type !== "invite") return json({ error: "Bağlantı kullanılamadı veya süresi doldu." }, 403);
    return json({ ok: true, recovery: parsed.data.type === "recovery", setPassword: parsed.data.type === "invite" || parsed.data.type === "recovery" });
  } catch (error) { return participantFailure(error); }
}
