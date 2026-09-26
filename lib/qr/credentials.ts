import { createHash, randomBytes } from "node:crypto";

export function createQrValue(): string {
  return `AERO1:${randomBytes(32).toString("base64url")}`;
}

export function hashQrValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isQrValue(value: string): boolean {
  return /^AERO1:[A-Za-z0-9_-]{43}$/.test(value);
}

export function createManualCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from(randomBytes(10), (byte) => alphabet[byte % alphabet.length]).join("");
}
