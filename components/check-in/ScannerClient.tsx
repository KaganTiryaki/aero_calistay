"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type QrScanner from "qr-scanner";
import { operations } from "@/lib/content";

type Result = { result: "recorded" | "already" | "invalid" | "inactive" | "closed"; firstName?: string; lastName?: string; committee?: string; checkedInAt?: string };

export function ScannerClient() {
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<QrScanner | null>(null);
  const request = useRef<{ code: string; id: string } | null>(null);
  const submitting = useRef(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  useEffect(() => () => { scanner.current?.destroy(); scanner.current = null; }, []);
  async function stopCamera() { scanner.current?.stop(); setActive(false); }
  async function submit(code: string) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError("");
    if (!request.current || request.current.code !== code) request.current = { code, id: crypto.randomUUID() };
    try {
      const response = await fetch("/api/check-in", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, requestId: request.current.id }),
      });
      if (!response.ok) throw new Error("request failed");
      setResult(await response.json() as Result);
      await stopCamera();
    } catch { setError(operations.scanner.offline); await stopCamera(); }
    submitting.current = false;
    setBusy(false);
  }
  async function startCamera() {
    setError(""); setResult(null);
    if (!video.current) return;
    try {
      const { default: QrScannerClass } = await import("qr-scanner");
      scanner.current?.destroy();
      scanner.current = new QrScannerClass(video.current, (decoded) => { void submit(decoded.data); }, {
        preferredCamera: "environment", highlightScanRegion: true, returnDetailedScanResult: true,
      });
      await scanner.current.start(); setActive(true);
    } catch { setError("Kamera açılamadı. İzin verin veya manuel kart kodunu girin."); setActive(false); }
  }
  function manualSubmit(event: FormEvent) { event.preventDefault(); void submit(manual.trim().toUpperCase()); }
  function next() { setResult(null); setError(""); setManual(""); request.current = null; }
  const title = result ? operations.scanner[result.result] : "";
  return <main className="ops-main ops-scanner"><div className="ops-page-head"><div><h1>{operations.scanner.title}</h1><p>Yaka kartını okutun veya altındaki kodu girin.</p></div><Link href="/panel/basvurular" className="ops-button">Panel</Link></div>
    <section className="ops-card"><video ref={video} playsInline muted aria-label="QR kamera görüntüsü" />
      <div className="ops-actions"><button className="ops-button--primary" disabled={busy || active} onClick={startCamera}>{operations.scanner.open}</button><button disabled={!active} onClick={stopCamera}>{operations.scanner.stop}</button></div>
      <form className="ops-form" onSubmit={manualSubmit}><label>{operations.scanner.manual}<input value={manual} onChange={(event) => setManual(event.target.value)} autoCapitalize="characters" autoComplete="off" /></label><button disabled={busy || manual.trim().length < 8}>{operations.scanner.check}</button></form>
      {error && <p role="alert" className="ops-error">{error}</p>}
    </section>
    {result && <div role="status" className="ops-scanner-result"><strong>{title}</strong>{result.firstName && <p>{result.firstName} {result.lastName}</p>}{result.committee && <p>{result.committee}</p>}{result.checkedInAt && <p>{new Date(result.checkedInAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</p>}<button onClick={next}>{operations.scanner.next}</button></div>}
  </main>;
}
