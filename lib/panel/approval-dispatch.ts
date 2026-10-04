import type { MailDispatchOutcome } from "../mail/status";

export function dispatchDecision(outcome:Pick<MailDispatchOutcome,"dispatchReady"|"canContinue"|"pending"|"failedTotal"|"uncertainTotal">, previousPending:number):"continue"|"stop"|"complete" {
  if(outcome.pending===0&&outcome.failedTotal===0&&outcome.uncertainTotal===0)return "complete";
  if(!outcome.dispatchReady||!outcome.canContinue||outcome.failedTotal>0||outcome.uncertainTotal>0)return "stop";
  if(outcome.pending>=previousPending)return "stop";
  return "continue";
}
