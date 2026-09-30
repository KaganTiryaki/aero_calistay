import { isIP } from "node:net";

export type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
  platform: string | null;
  deviceClass: "mobile" | "desktop" | "unknown";
};

function shortHeader(value: string | null, maxLength: number): string | null {
  const safe = value?.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, maxLength);
  return safe || null;
}

export function requestMetadata(headers: Headers): RequestMetadata {
  const forwarded = headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for") ?? headers.get("x-real-ip");
  const candidate = forwarded?.split(",", 1)[0]?.trim() ?? "";
  const userAgent = shortHeader(headers.get("user-agent"), 512);
  const platform = shortHeader(headers.get("sec-ch-ua-platform")?.replace(/^"|"$/g, "") ?? null, 80);
  const mobileHint = headers.get("sec-ch-ua-mobile");
  return {
    ipAddress: isIP(candidate) ? candidate : null,
    userAgent,
    platform,
    deviceClass: mobileHint === "?1" ? "mobile" : mobileHint === "?0" ? "desktop"
      : userAgent?.includes("Mobile") ? "mobile" : userAgent ? "desktop" : "unknown",
  };
}
