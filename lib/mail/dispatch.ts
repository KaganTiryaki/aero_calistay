type Reply = { enabled?: boolean; processed?: number; accepted?: number };

export async function callMailWorker(input: { action: "health" } | { batchId: string; limit: number }) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.MAIL_QUEUE_SECRET;
  if (!base || !secret) return { ready: false, processed: 0, accepted: 0 };
  try {
    const response = await fetch(new URL("/functions/v1/process-mail-queue", base), {
      method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(input), cache: "no-store", signal: AbortSignal.timeout("action" in input ? 5000 : 45000),
    });
    if (!response.ok) return { ready: false, processed: 0, accepted: 0 };
    const data = await response.json() as Reply;
    return { ready: data.enabled === true, processed: data.processed ?? 0, accepted: data.accepted ?? 0 };
  } catch { return { ready: false, processed: 0, accepted: 0 }; }
}
