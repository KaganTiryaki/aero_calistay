type JobStatus = { status: string; delivery_status: string; last_error: string | null };

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
