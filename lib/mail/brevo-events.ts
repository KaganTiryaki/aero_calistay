import { createHash } from "node:crypto";

export type DeliveryStatus = "unknown" | "delivered" | "deferred" | "soft_bounced" | "hard_bounced" | "blocked" | "invalid" | "complained" | "error" | "unsubscribed";

export function classifyBrevoEvent(event: string): { confirmsSend: boolean; deliveryStatus: DeliveryStatus } {
  const statuses: Record<string, DeliveryStatus> = {
    delivered: "delivered", deferred: "deferred", soft_bounce: "soft_bounced",
    hard_bounce: "hard_bounced", blocked: "blocked", invalid_email: "invalid",
    spam: "complained", error: "error", unsubscribed: "unsubscribed",
  };
  return { confirmsSend: event === "request" || event === "delivered", deliveryStatus: statuses[event] ?? "unknown" };
}

export function eventFingerprint(event: { messageId: string; email: string; event: string; date: number | string }): string {
  const timestamp = new Date(typeof event.date === "number" ? event.date * 1000 : event.date).toISOString();
  return createHash("sha256").update(JSON.stringify([
    event.messageId.trim().replace(/^<|>$/g, "").toLowerCase(), event.email.trim().toLowerCase(), event.event, timestamp,
  ])).digest("hex");
}

export function brevoEventTime(input: { tsEvent?: number | string; date?: number | string }): string | null {
  const epoch = input.tsEvent ?? (typeof input.date === "number" ? input.date : null);
  const zonedDate = typeof input.date === "string" && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(input.date)
    ? input.date : null;
  const parsed = epoch !== null ? new Date(Number(epoch) * 1000) : new Date(zonedDate ?? Number.NaN);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
