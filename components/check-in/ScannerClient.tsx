"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type QrScanner from "qr-scanner";
import { operations } from "@/lib/content";
import { observeScan, type ScanGate } from "@/lib/check-in/scan-gate";

type Result = { result: "recorded" | "already" | "invalid" | "inactive" | "closed"; firstName?: string; lastName?: string; committee?: string; checkedInAt?: string };

export function ScannerClient() {
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<QrScanner | null>(null);
  const request = useRef<{ code: string; id: string; mealId: string } | null>(null);
  const pendingKey = useRef("");
  const submitting = useRef(false);
  const gate = useRef<ScanGate>({ code: "", lastSeen: 0, blockedUntil: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const meal = useRef<{ id: string; name: string } | null>(null);
  const [mealName, setMealName] = useState("");
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/check-in", { cache: "no-store" }).then((response) => { if (!response.ok) throw new Error(operations.scanner.loginExpired); return response.json(); }).then((body) => {
      meal.current = body.meal; setMealName(body.meal?.name ?? operations.scanner.noMeal);
      if (typeof body.userId === "string") {
        pendingKey.current = `aero-scan-pending:${body.userId}`;
        try {
          const saved = JSON.parse(sessionStorage.getItem(pendingKey.current) ?? "null");
          if (saved && typeof saved.code === "string" && saved.code.length <= 80 && /^[0-9a-f-]{36}$/.test(saved.id) && /^[0-9a-f-]{36}$/.test(saved.mealId)) {
            request.current = saved; setError(operations.scanner.offline);
          }
        } catch { /* Geçersiz yerel veri kullanılmaz. */ }
      }
    }).catch((cause) => setError(cause instanceof Error ? cause.message : operations.scanner.offline));
    return () => { scanner.current?.destroy(); scanner.current = null; if (timer.current) clearTimeout(timer.current); void audio.current?.close(); };
  }, []);
  function sound(ok: boolean) {
    if (!ok && typeof navigator.vibrate === "function") navigator.vibrate([150, 80, 150]);
    try {
      const context = audio.current; if (!context || context.state !== "running") return;
      const oscillator = context.createOscillator(); const gain = context.createGain();
      oscillator.type = ok ? "sine" : "triangle"; oscillator.frequency.value = ok ? 880 : 180;
      gain.gain.setValueAtTime(0.12, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.18);
    } catch { /* Görsel sonuç her durumda gösterilir. */ }
  }
  function prepareAudio() { try { audio.current ??= new AudioContext(); void audio.current.resume(); } catch { /* Ses desteklenmeyebilir. */ } }
  async function stopCamera() { scanner.current?.stop(); setActive(false); }
  async function submit(code: string) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError("");
    if (!meal.current && !request.current) { setError(operations.scanner.noMeal); submitting.current = false; setBusy(false); return; }
    if (request.current && request.current.code !== code) { setError(operations.scanner.offline); submitting.current = false; setBusy(false); return; }
    request.current ??= { code, id: crypto.randomUUID(), mealId: meal.current!.id };
    try { if (pendingKey.current) sessionStorage.setItem(pendingKey.current, JSON.stringify(request.current)); } catch { /* Opsiyonel saklama. */ }
    try {
      const response = await fetch("/api/check-in", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, requestId: request.current.id, mealSessionId: request.current.mealId }),
      });
      if (!response.ok) throw new Error("request failed");
      const next = await response.json() as Result;
      try { if (pendingKey.current) sessionStorage.removeItem(pendingKey.current); } catch { /* Opsiyonel saklama. */ }
      setResult(next);
      if (next.result === "recorded" || next.result === "already") sound(next.result === "recorded");
      gate.current.blockedUntil = Date.now() + 2000;
      timer.current = setTimeout(() => { setResult(null); setManual(""); request.current = null; }, 2000);
    } catch { setError(operations.scanner.offline); await stopCamera(); }
    submitting.current = false;
    setBusy(false);
  }
  async function startCamera() {
    prepareAudio();
    setError(""); setResult(null);
    if (!video.current) return;
    try {
      const { default: QrScannerClass } = await import("qr-scanner");
      scanner.current?.destroy();
      scanner.current = new QrScannerClass(video.current, (decoded) => { if (observeScan(gate.current, decoded.data, Date.now())) void submit(decoded.data); }, {
        preferredCamera: "environment", highlightScanRegion: true, returnDetailedScanResult: true,
      });
      await scanner.current.start(); setActive(true);
    } catch { setError("Kamera açılamadı. İzin verin veya manuel kart kodunu girin."); setActive(false); }
  }
  function manualSubmit(event: FormEvent) { event.preventDefault(); prepareAudio(); void submit(manual.trim().toUpperCase()); }
  const title = result ? operations.scanner[result.result] : "";
  return <main className="ops-main ops-scanner"><div className="ops-page-head"><div><h1>{operations.scanner.title}</h1><p>{operations.scanner.description} {mealName}</p></div><Link href="/panel/basvurular" className="ops-button">Panel</Link></div>
    <section className="ops-card"><video ref={video} playsInline muted aria-label="QR kamera görüntüsü" />
      <div className="ops-actions"><button className="ops-button--primary" disabled={busy || active || !!request.current || !meal.current} onClick={startCamera}>{operations.scanner.open}</button><button disabled={!active} onClick={stopCamera}>{operations.scanner.stop}</button></div>
      <form className="ops-form" onSubmit={manualSubmit}><label>{operations.scanner.manual}<input value={manual} onChange={(event) => setManual(event.target.value)} autoCapitalize="characters" autoComplete="off" /></label><button disabled={busy || manual.trim().length < 8}>{operations.scanner.check}</button></form>
      {error && <p role="alert" className="ops-error">{error}</p>}
      {error && request.current && <button type="button" disabled={busy} onClick={() => { prepareAudio(); void submit(request.current!.code); }}>{operations.scanner.retry}</button>}
    </section>
    {result && <div role="status" className="ops-scanner-result" data-result={result.result}><strong>{title}</strong>{result.firstName && <p>{result.firstName} {result.lastName}</p>}{result.committee && <p>{result.committee}</p>}{result.checkedInAt && <p>{new Date(result.checkedInAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</p>}</div>}
  </main>;
}
