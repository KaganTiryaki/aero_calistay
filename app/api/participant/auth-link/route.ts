import { participantGate } from "@/lib/participant/gates";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { json, protectMutation } from "@/lib/http";
import { identityHash, trustedIp } from "@/lib/participant/auth";
import { callMailWorker } from "@/lib/mail/dispatch";
const schema=z.object({email:z.email().max(254),purpose:z.enum(["activate","recovery"])});
const generic={ok:true,message:"Uygun bir hesabınız veya davetiniz varsa bağlantı e-postanıza gönderilecek."};
export async function POST(request:NextRequest){
 try{
  protectMutation(request); const disabled=participantGate("rollout");if(disabled)return disabled;const parsed=schema.safeParse(await request.json());if(!parsed.success)return json(generic,202);
  const email=parsed.data.email.trim().toLowerCase();const ip=trustedIp(request);
  const material=Buffer.from(process.env.AUTH_MAIL_PAYLOAD_KEY??"","base64");if(material.length!==32)throw new Error("AUTH_MAIL_KEY_INVALID");
  const client=createAdminSupabase();const reserved=await client.rpc("reserve_participant_auth_link",{p_email_hash:identityHash(`email:${email}`),p_ip_hash:identityHash(`ip:${ip}`),p_purpose:parsed.data.purpose});
  if(reserved.error)throw reserved.error;const row=Array.isArray(reserved.data)?reserved.data[0]:reserved.data;if(!row)throw new Error("AUTH_LIMIT_UNAVAILABLE");
  if(!row.allowed){const response=json({error:"Çok fazla bağlantı isteği. Lütfen bekleyin."},429);response.headers.set("Retry-After",String(Math.max(1,row.wait_seconds??60)));return response;}
  const health=await callMailWorker({action:"health"});if(!health.ready)throw new Error("MAIL_UNAVAILABLE");
  const queued=await client.rpc("request_participant_auth_mail",{p_email:email,p_purpose:parsed.data.purpose,p_request_id:randomUUID()});if(queued.error)throw queued.error;
  if(queued.data){const sent=await callMailWorker({batchId:queued.data,limit:1});if(!sent.ready || sent.failed>0)throw new Error("AUTH_MAIL_UNAVAILABLE");}
  return json(generic,202);
 }catch{return json({error:"Bağlantı şu an oluşturulamadı. Lütfen daha sonra tekrar deneyin."},503);}
}
