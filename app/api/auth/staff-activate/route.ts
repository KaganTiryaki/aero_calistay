import { NextRequest } from "next/server";
import { z } from "zod";
import { json, protectMutation } from "@/lib/http";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { reserveAuthAttempt, recordAuthAttempt, writeActivationProof } from "@/lib/participant/auth";
export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    const types=z.enum(["invite","magiclink","recovery"]);
    const parsed = z.union([z.object({tokenHash:z.string().min(16).max(512),type:types}),z.object({session:z.literal(true),type:types})]).safeParse(await request.json());
    if(!parsed.success)return json({error:"Bağlantı kullanılamadı."},400);
    const limited=await reserveAuthAttempt(request,"activation");if(limited)return limited;
    const server=await createServerSupabase();
    const current=await server.auth.getUser();
    const fromSession="session" in parsed.data;
    if(!fromSession && current.data.user)return json({error:"Önce mevcut hesabınızdan çıkış yapın."},409);
    const verified="tokenHash" in parsed.data ? await server.auth.verifyOtp({token_hash:parsed.data.tokenHash,type:parsed.data.type}) : current;
    if(verified.error || !verified.data.user?.email_confirmed_at){await recordAuthAttempt(request,"activation",false);return json({error:"Bağlantı kullanılamadı."},400);}
    const valid=await createAdminSupabase().rpc("validate_staff_activation",{p_user_id:verified.data.user.id});
    if(valid.error || valid.data!==true){await server.auth.signOut();return json({error:"Bu hesap için personel erişimi bulunamadı."},403);}
    if(parsed.data.type!=="magiclink")await writeActivationProof({userId:verified.data.user.id,jobId:null,fingerprint:null,type:parsed.data.type,audience:"staff"});
    await recordAuthAttempt(request,"activation",true);
    return json({ok:true,setPassword:parsed.data.type!=="magiclink"});
  }catch{return json({error:"Bağlantı şu an doğrulanamıyor."},503);}
}
