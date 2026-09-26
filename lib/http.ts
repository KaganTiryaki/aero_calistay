import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/security";

export const privateHeaders = { "Cache-Control": "private, no-store" };

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: privateHeaders });
}

export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  const status = message === "FORBIDDEN" ? 403 : message === "BAD_REQUEST" ? 400 : 500;
  return json({ error: status === 500 ? "İşlem tamamlanamadı." : message }, status);
}

export function protectMutation(request: NextRequest) {
  if (!sameOrigin(request.headers.get("origin"), request.nextUrl.origin)) throw new Error("FORBIDDEN");
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("BAD_REQUEST");
}
