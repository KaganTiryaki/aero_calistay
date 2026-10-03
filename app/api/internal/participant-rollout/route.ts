import {NextRequest} from "next/server";
import {json} from "@/lib/http";
import {verifyBearer} from "@/lib/security";
import {createAdminSupabase} from "@/lib/supabase/admin";
import {callMailWorker} from "@/lib/mail/dispatch";
export async function GET(request:NextRequest){return probe(request,"health");}
export async function POST(request:NextRequest){return probe(request,"reconcile");}
async function probe(request:NextRequest,action:"health"|"reconcile"){
 const secret=process.env.PARTICIPANT_ROLLOUT_MONITOR_SECRET;
 if(!secret || secret.length<32 || !verifyBearer(request.headers.get("authorization"),secret))return json({error:"Unauthorized"},401);
 try{
  const {data,error}=await createAdminSupabase().from("events").select("participant_rollout_enabled,participant_acceptance_enabled,participant_payment_mutations_enabled").limit(1);
  if(error || !data?.[0])throw new Error("SCHEMA_UNAVAILABLE");
  const worker=await callMailWorker({action});
  const keysReady=Boolean(process.env.PARTICIPANT_AUTH_LINK_HMAC_KEY && Buffer.from(process.env.AUTH_MAIL_PAYLOAD_KEY??"","base64").length===32);
  return json({schemaReady:true,keysReady,workerReady:worker.ready,gates:data[0],action},worker.ready && keysReady?200:503);
 }catch{return json({error:"Rollout services unavailable"},503);}
}
