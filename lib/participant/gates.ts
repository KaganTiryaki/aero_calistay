import "server-only";
import { json } from "@/lib/http";
export function participantGate(feature:"rollout"|"acceptance"|"payment"="rollout") {
  const name=feature==="acceptance"?"PARTICIPANT_ACCEPTANCE_ENABLED":feature==="payment"?"PARTICIPANT_PAYMENT_MUTATIONS_ENABLED":"PARTICIPANT_ROLLOUT_ENABLED";
  if(process.env.NODE_ENV==="production" && (process.env.PARTICIPANT_ROLLOUT_ENABLED!=="true" || process.env[name]!=="true"))return json({error:"Katılımcı işlemleri henüz açılmadı. Lütfen daha sonra tekrar deneyin."},503);
  return null;
}
