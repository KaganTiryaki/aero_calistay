"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { operations } from "@/lib/content";

type Application = { id: string; first_name: string; last_name: string; email: string; status: string; version: number };
export type SelectedApplication = { id: string; firstName: string; lastName: string; email: string; version: number };
const storageKey = "aero-selected-applications";

export function readSelection(): SelectedApplication[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value.filter((item): item is SelectedApplication =>
      typeof item === "object" && item !== null && typeof item.id === "string" &&
      typeof item.firstName === "string" && typeof item.lastName === "string" &&
      typeof item.email === "string" && typeof item.version === "number") : [];
  } catch { return []; }
}
export function persistSelection(value: SelectedApplication[]) { sessionStorage.setItem(storageKey, JSON.stringify(value)); }
function selectedOf(item: Application): SelectedApplication { return { id: item.id, firstName: item.first_name, lastName: item.last_name, email: item.email, version: item.version }; }

export function ApplicationsClient() {
  const [items, setItems] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("pending");
  const [selection, setSelection] = useState<SelectedApplication[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), q: appliedSearch, status });
      const response = await fetch(`/api/panel/applications?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const body = await response.json() as { items: Application[]; total: number };
      setItems(body.items); setTotal(body.total); setMessage("");
      const pendingIds = new Set(body.items.filter((item) => item.status === "pending").map((item) => item.id));
      setSelection((current) => {
        const next = current.filter((item) => !body.items.some((row) => row.id === item.id) || pendingIds.has(item.id));
        if (next.length !== current.length) persistSelection(next);
        return next;
      });
    } catch { setMessage("Başvurular yüklenemedi. Yenile düğmesine tekrar basın."); }
    finally { setLoading(false); }
  }, [page, appliedSearch, status]);
  useEffect(() => { setSelection(readSelection()); void load(); }, [load]);
  function choose(next: SelectedApplication[]) { setSelection(next); persistSelection(next); }
  function toggle(item: Application) {
    choose(selection.some((row) => row.id === item.id)
      ? selection.filter((row) => row.id !== item.id)
      : [...selection, selectedOf(item)]);
  }
  function searchNow() { setPage(1); setAppliedSearch(search); if (search === appliedSearch) void load(); }
  return <div className="ops-stack">
    <div className="ops-page-head"><div><h1>Başvurular</h1><p>Onaylamak istediğiniz kişinin yanındaki <strong>Seç</strong> düğmesine basın.</p></div></div>
    <div className="ops-step" aria-label="İşlem sırası"><strong>1. Kişileri seç</strong><span>→</span><span>2. Komiteyi belirle ve e-postayı gönder</span></div>
    <section className="ops-card ops-card--soft"><div className="ops-toolbar"><label>İsim veya e-posta ara<input value={search} placeholder="Ad, soyad veya e-posta" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") searchNow(); }} /></label><label>Göster<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="pending">Onay bekleyenler</option><option value="approval_queued">E-posta kuyruğunda</option><option value="approved">Onaylananlar</option><option value="cancelled">İptal edilenler</option><option value="">Tüm başvurular</option></select></label><div className="ops-actions"><button onClick={searchNow}>Ara</button><button onClick={() => void load()} disabled={loading}>Yenile</button></div></div><p className="ops-note">Başvurular Google Form üzerinden otomatik gelir.</p></section>
    {message && <p role="alert" className="ops-error">{message}</p>}
    <section aria-label="Başvuru listesi">
      {loading ? <div className="ops-empty">Başvurular yükleniyor…</div> : items.length ? <div className="ops-person-list">{items.map((item) => {
        const selected = selection.some((row) => row.id === item.id);
        const selectable = item.status === "pending";
        return <article className="ops-person" data-selected={selected} key={item.id}>
          <div className="ops-person-details"><strong>{item.first_name} {item.last_name}</strong><span>{item.email}</span><span className="ops-pill">{(operations.applicationStatus as Record<string, string>)[item.status] ?? item.status}</span></div>
          {selectable ? <button type="button" className={selected ? "ops-button--selected" : "ops-button--primary"} aria-pressed={selected} onClick={() => toggle(item)}>{selected ? "✓ Seçildi · Kaldır" : "Bu kişiyi seç"}</button> : <span className="ops-note">Bu başvuru artık seçilemez</span>}
        </article>;
      })}</div> : <div className="ops-empty">Bu filtrede başvuru yok. Başka bir durum seçin veya aramayı temizleyin.</div>}
      <div className="ops-pagination"><span>{total} başvuru · sayfa {page}</span><div className="ops-actions"><button disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Önceki</button><button disabled={page * 50 >= total || loading} onClick={() => setPage(page + 1)}>Sonraki</button></div></div>
    </section>
    {selection.length > 0 && <section className="ops-selection-summary" aria-live="polite"><div><strong>{selection.length} kişi seçildi</strong><p>Seçimi değiştirmek için kişinin yanındaki düğmeye tekrar basın.</p></div><div className="ops-actions"><button type="button" onClick={() => choose([])}>Tüm seçimi kaldır</button><Link className="ops-button ops-button--primary" href="/panel/onay">Komite seçimine devam et →</Link></div></section>}
  </div>;
}
