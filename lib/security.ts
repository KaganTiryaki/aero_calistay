import { createHash, timingSafeEqual } from "node:crypto";

export function sameOrigin(origin: string | null, target: string): boolean {
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(target).origin;
  } catch {
    return false;
  }
}

export function verifyBearer(header: string | null, token: string): boolean {
  if (!header?.startsWith("Bearer ") || !token) return false;
  const actual = createHash("sha256").update(header.slice(7)).digest();
  const expected = createHash("sha256").update(token).digest();
  return timingSafeEqual(actual, expected);
}

export function safeCsvCell(value: string): string {
  return /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? `'${value}` : value;
}

export function csvRow(values: string[]): string {
  return values.map((value) => `"${safeCsvCell(value).replaceAll('"', '""')}"`).join(",");
}

export function safeReturnPath(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/giris";
  try {
    const url = new URL(value, "https://aero.local");
    return url.origin === "https://aero.local" ? `${url.pathname}${url.search}` : "/giris";
  } catch { return "/giris"; }
}
