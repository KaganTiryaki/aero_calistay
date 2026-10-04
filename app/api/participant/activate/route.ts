import { participantGate } from "@/lib/participant/gates";
import { NextRequest } from "next/server";
import { z } from "zod";
import { json, protectMutation } from "@/lib/http";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { readActivationProof, clearActivationProof } from "@/lib/participant/auth";
import { participantFailure } from "@/lib/participant/server";
export async function GET() {
  try {
    const proof = await readActivationProof();
    if (proof.audience === "participant") { const disabled = participantGate("rollout"); if (disabled) return disabled; }
    const { data, error } = await (await createServerSupabase()).auth.getUser();
    if (error || !data.user?.email_confirmed_at || data.user.id !== proof.userId) throw new Error("FORBIDDEN");
    const admin = createAdminSupabase();
    const valid = proof.audience === "participant"
      ? await admin.rpc("validate_participant_activation", { p_user_id: proof.userId, p_job_id: proof.jobId, p_fingerprint: proof.fingerprint, p_type: proof.type })
      : await admin.rpc("validate_staff_activation", { p_user_id: proof.userId });
    if (valid.error || valid.data !== true) throw new Error("FORBIDDEN");
    return json({ setPassword: true, audience: proof.audience });
  } catch (error) { return participantFailure(error); }
}
export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    const parsed = z.object({password:z.string().min(6).max(256)}).safeParse(await request.json());
    if (!parsed.success) return json({error:"Yeni şifre 6–256 karakter olmalı."},400);
    const proof = await readActivationProof();
    if(proof.audience === "participant") { const disabled=participantGate("rollout");if(disabled)return disabled; }
    const server = await createServerSupabase(), admin = createAdminSupabase();
    const {data,error} = await server.auth.getUser();
    if (error || !data.user?.email_confirmed_at || data.user.id !== proof.userId) throw new Error("FORBIDDEN");
    const valid = proof.audience === "participant"
      ? await admin.rpc("validate_participant_activation",{p_user_id:proof.userId,p_job_id:proof.jobId,p_fingerprint:proof.fingerprint,p_type:proof.type})
      : await admin.rpc("validate_staff_activation",{p_user_id:proof.userId});
    if (valid.error || valid.data !== true) throw new Error("FORBIDDEN");
    const saved = await server.auth.updateUser({password:parsed.data.password});
    if (saved.error) return json({error:"Şifre kaydedilemedi. Yeniden deneyin."},saved.error.status === 429 ? 429 : 503);
    if (proof.audience === "participant") {
      const claimed = await admin.rpc("claim_participant_account",{p_user_id:proof.userId}); if (claimed.error) throw claimed.error;
    }
    await clearActivationProof(); return json({ok:true});
  } catch(error) {return participantFailure(error);}
}
