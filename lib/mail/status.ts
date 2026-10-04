type JobStatus = { status: string; delivery_status: string; last_error: string | null; next_attempt_at?: string | null };
export type MailProviderCapacity={send_blocked_until:string|null;approval_budget:number;reserved_today:number;provider_remaining:number|null;auth_reserve:number;sent_day:string|null};
import type { DispatchResult } from "./dispatch";

export type MailDispatchOutcome = ReturnType<typeof mailDispatchOutcome>;

export function providerCanSend(state:MailProviderCapacity|null,now=new Date()){
  if(!state||state.send_blocked_until&&Date.parse(state.send_blocked_until)>now.getTime())return false;
  const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const used=state.sent_day===today?state.reserved_today:0;
  return state.approval_budget>used&&(state.provider_remaining===null||state.provider_remaining>state.auth_reserve);
}

export function canContinueMailJobs(jobs: JobStatus[],now=new Date()) {
  return jobs.some((job) => ["queued","quota_wait"].includes(job.status)&&(!job.next_attempt_at||Date.parse(job.next_attempt_at)<=now.getTime()))
    && !jobs.some((job) => ["sending", "uncertain", "failed"].includes(job.status));
}

export function summarizeMailJobs(jobs: JobStatus[]) {
  return {
    acceptedTotal: jobs.filter((job) => job.status === "provider_accepted" || job.status === "sent").length,
    deliveredTotal: jobs.filter((job) => job.delivery_status === "delivered").length,
    pending: jobs.filter((job) => ["queued", "quota_wait", "sending"].includes(job.status)).length,
    failedTotal: jobs.filter((job) => job.status === "failed").length,
    uncertainTotal: jobs.filter((job) => job.status === "uncertain").length,
    issue: jobs.find((job) => job.last_error)?.last_error ?? null,
  };
}

export function mailDispatchOutcome(batchId: string, dispatch: DispatchResult, jobs: JobStatus[]) {
  return {
    batchId, dispatchReady: dispatch.ready, canContinue: dispatch.ready && !dispatch.blocked && canContinueMailJobs(jobs),
    ...summarizeMailJobs(jobs), code: dispatch.code, error: dispatch.error,
  };
}
