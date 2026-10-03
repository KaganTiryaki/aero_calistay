import { participantGate } from "@/lib/participant/gates";
import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { json, protectMutation } from "@/lib/http";
import { participantFailure } from "@/lib/participant/server";
import { reserveAuthAttempt, recordAuthAttempt, tokenFingerprint, writeActivationProof } from "@/lib/participant/auth";

const schema = z.object({ tokenHash: z.string().min(16).max(512), type: z.enum(["invite", "magiclink", "recovery"]), jobId: z.string().uuid() });
export async function POST(request: NextRequest) {
  try {
    protectMutation(request); const disabled=participantGate("rollout");if(disabled)return disabled;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Bağlantı kullanılamadı veya süresi doldu." }, 400);
    const limited = await reserveAuthAttempt(request,"activation"); if (limited) return limited;
    const server = await createServerSupabase();
    const current = await server.auth.getUser();
    if (current.data.user) return json({ error: "Bağlantıyı açmadan önce mevcut hesabınızdan çıkış yapın." },409);
    const verified = await server.auth.verifyOtp({ token_hash: parsed.data.tokenHash, type: parsed.data.type });
    if (verified.error || !verified.data.user?.email_confirmed_at) {
      await recordAuthAttempt(request,"activation",false);
      return json({ error: "Bağlantı kullanılamadı veya süresi doldu." }, verified.error?.status === 429 ? 429 : 400);
    }
    const admin = createAdminSupabase();
    const fingerprint = tokenFingerprint(parsed.data.tokenHash);
    const valid = await admin.rpc("validate_participant_activation", { p_user_id: verified.data.user.id, p_job_id: parsed.data.jobId, p_fingerprint: fingerprint, p_type: parsed.data.type });
    if (valid.error || valid.data !== true) { await server.auth.signOut(); return json({ error: "Bağlantı kullanılamadı veya süresi doldu." },403); }
    if (parsed.data.type === "magiclink") {
      const claimed = await admin.rpc("claim_participant_account",{p_user_id:verified.data.user.id});
      if (claimed.error) { await server.auth.signOut(); throw claimed.error; }
    } else await writeActivationProof({ userId: verified.data.user.id, jobId: parsed.data.jobId, fingerprint, type: parsed.data.type, audience: "participant" });
    await recordAuthAttempt(request,"activation",true);
    return json({ ok: true, recovery: parsed.data.type === "recovery", setPassword: parsed.data.type === "invite" || parsed.data.type === "recovery" });
  } catch (error) { return participantFailure(error); }
}
