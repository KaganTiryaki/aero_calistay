type JobStatus = { status: string; delivery_status: string; last_error: string | null };
import type { DispatchResult } from "./dispatch";

export type MailDispatchOutcome = ReturnType<typeof mailDispatchOutcome>;

export function canContinueMailJobs(jobs: JobStatus[]) {
  return jobs.some((job) => job.status === "queued")
    && !jobs.some((job) => ["quota_wait", "sending", "uncertain", "failed"].includes(job.status));
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
