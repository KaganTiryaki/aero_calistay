import type { MailJob } from "./brevo-client.ts";
type PayloadRow = { job_id:string; application_id:string; nonce:string; ciphertext:string; auth_tag:string; expires_at:string; recipient_email:string; auth_type:string; token_fingerprint:string };
type Context = {application_id:string;recipient_email:string;portal_url:string;auth_user_id:string|null;email_confirmed:boolean;purpose:string};
type AuthDatabase = {
  rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>;
  auth?:{admin:{generateLink(input:{type:"invite"|"magiclink"|"recovery";email:string}):Promise<{data:{properties:{hashed_token?:string}|null;user:{id:string}|null}|null;error:unknown}>}};
};
function decode(value:string){return Uint8Array.from(atob(value),char=>char.charCodeAt(0));}
function encode(value:Uint8Array){return btoa(String.fromCharCode(...value));}
export function authPayloadAAD(row:Pick<PayloadRow,"job_id"|"application_id"|"recipient_email"|"auth_type"|"expires_at"|"token_fingerprint">){
  return new TextEncoder().encode(JSON.stringify([row.job_id,row.application_id,row.recipient_email.toLowerCase(),row.auth_type,new Date(row.expires_at).toISOString(),row.token_fingerprint]));
}
async function fingerprint(token:string){const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)));return Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");}
export async function prepareParticipantAuthMail(db:AuthDatabase,job:MailJob,secret:string,now=Date.now()):Promise<MailJob>{
  let material:Uint8Array<ArrayBuffer>;try{material=decode(secret);}catch{throw new Error("AUTH_MAIL_KEY_INVALID");}
  if(material.byteLength!==32)throw new Error("AUTH_MAIL_KEY_INVALID");
  if(!job.id || !job.application_id)throw new Error("AUTH_MAIL_PAYLOAD_INVALID");
  const read=await db.rpc("read_participant_auth_mail",{p_job_id:job.id});
  if(read.error)throw new Error("AUTH_MAIL_PAYLOAD_UNAVAILABLE");
  let row=(read.data as PayloadRow[]|null)?.[0];
  if(!row){
    if(!db.auth)throw new Error("AUTH_MAIL_PAYLOAD_UNAVAILABLE");
    // Durable preparation lease is never retried after ambiguous generation/store.
    const reservation=await db.rpc("begin_participant_auth_preparation",{p_job_id:job.id});
    const context=(reservation.data as Context[]|null)?.[0];
    if(reservation.error || !context || context.application_id!==job.application_id || context.recipient_email.toLowerCase()!==job.recipient_email.toLowerCase() || !/^https:\/\/[^ /?#]+\/katilimci$/.test(context.portal_url))throw new Error("AUTH_PREPARATION_NOT_SAFE");
    const type=context.auth_user_id && context.email_confirmed ? context.purpose==="recovery"?"recovery":"magiclink":"invite";
    const generated=await db.auth.admin.generateLink({type,email:context.recipient_email});
    const token=generated.data?.properties?.hashed_token;
    if(generated.error || !token || !generated.data?.user?.id)throw new Error("AUTH_MAIL_GENERATE_FAILED");
    const expiresAt=new Date(now+60*60_000).toISOString();const tokenFingerprint=await fingerprint(token);
    const url=new URL(`${context.portal_url}/aktivasyon`);url.searchParams.set("token_hash",token);url.searchParams.set("type",type);url.searchParams.set("job",job.id);
    const bound={job_id:job.id,application_id:job.application_id,recipient_email:job.recipient_email,auth_type:type,expires_at:expiresAt,token_fingerprint:tokenFingerprint};
    const payload={email:context.recipient_email,url:url.toString(),expiresAt,jobId:job.id,applicationId:job.application_id,type,fingerprint:tokenFingerprint};
    const nonce=crypto.getRandomValues(new Uint8Array(12));const key=await crypto.subtle.importKey("raw",material,"AES-GCM",false,["encrypt"]);
    const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:nonce,additionalData:authPayloadAAD(bound),tagLength:128},key,new TextEncoder().encode(JSON.stringify(payload))));
    const stored=await db.rpc("store_bound_participant_auth_mail",{p_job_id:job.id,p_application_id:job.application_id,p_user_id:generated.data.user.id,p_type:type,p_fingerprint:tokenFingerprint,p_nonce:encode(nonce),p_ciphertext:encode(encrypted.slice(0,-16)),p_auth_tag:encode(encrypted.slice(-16)),p_expires_at:expiresAt});
    if(stored.error || stored.data!==true)throw new Error("AUTH_MAIL_STORE_UNCONFIRMED");
    const reread=await db.rpc("read_participant_auth_mail",{p_job_id:job.id});
    if(reread.error)throw new Error("AUTH_MAIL_PAYLOAD_UNAVAILABLE");row=(reread.data as PayloadRow[]|null)?.[0];
  }
  if(!row || row.job_id!==job.id || row.application_id!==job.application_id || row.recipient_email.toLowerCase()!==job.recipient_email.toLowerCase() || !Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at)<=now)throw new Error("AUTH_MAIL_PAYLOAD_INVALID");
  const key=await crypto.subtle.importKey("raw",material,"AES-GCM",false,["decrypt"]);
  const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(row.nonce),additionalData:authPayloadAAD(row),tagLength:128},key,new Uint8Array([...decode(row.ciphertext),...decode(row.auth_tag)]));
  const payload=JSON.parse(new TextDecoder().decode(clear)) as {email:string;url:string;expiresAt:string;jobId:string;applicationId:string;type:string;fingerprint:string};
  const url=new URL(payload.url);
  if(payload.email.toLowerCase()!==job.recipient_email.toLowerCase() || Date.parse(payload.expiresAt)!==Date.parse(row.expires_at) || payload.jobId!==job.id || payload.applicationId!==job.application_id || payload.type!==row.auth_type || payload.fingerprint!==row.token_fingerprint || url.protocol!=="https:" || url.pathname!=="/katilimci/aktivasyon" || url.searchParams.get("type")!==row.auth_type || url.searchParams.get("job")!==job.id || await fingerprint(url.searchParams.get("token_hash")??"")!==row.token_fingerprint)throw new Error("AUTH_MAIL_PAYLOAD_INVALID");
  const safeUrl=url.toString().replaceAll("&","&amp;").replaceAll('"',"&quot;");
  return {...job,html_content:`${job.html_content}<p><a href="${safeUrl}">Hesabım için güvenli bağlantı</a></p>`,text_content:`${job.text_content}\n\nHesabım için güvenli bağlantı: ${url.toString()}`};
}
