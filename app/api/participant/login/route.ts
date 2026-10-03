import { participantGate } from "@/lib/participant/gates";
import { NextRequest } from "next/server";
import { z } from "zod";
import { json, protectMutation } from "@/lib/http";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { reserveAuthAttempt, recordAuthAttempt } from "@/lib/participant/auth";
export async function POST(request:NextRequest) {
  try {
    protectMutation(request); const disabled=participantGate("rollout");if(disabled)return disabled;
    const parsed=z.object({email:z.email().max(254),password:z.string().min(1).max(256)}).safeParse(await request.json());
    if (!parsed.success) return json({error:"E-posta ve şifrenizi kontrol edin."},400);
    const limited=await reserveAuthAttempt(request,"login");if(limited)return limited;
    const server=await createServerSupabase();
    const {data,error}=await server.auth.signInWithPassword({email:parsed.data.email.trim().toLowerCase(),password:parsed.data.password});
    if(error || !data.user?.email_confirmed_at) {
      await server.auth.signOut(); await recordAuthAttempt(request,"login",false);
      return json({error:"E-posta ve şifrenizi kontrol edin."},error?.status === 429 ? 429 : error?.status && error.status>=500 ? 503 : 401);
    }
    const claimed=await createAdminSupabase().rpc("claim_participant_account",{p_user_id:data.user.id});
    if(claimed.error){await server.auth.signOut();await recordAuthAttempt(request,"login",false);return json({error:"E-posta ve şifrenizi kontrol edin."},403);}
    await recordAuthAttempt(request,"login",true);return json({ok:true});
  }catch{return json({error:"Giriş şu an tamamlanamıyor. Lütfen yeniden deneyin."},503);}
}
