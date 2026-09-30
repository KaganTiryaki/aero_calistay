"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { operations } from "@/lib/content";

type Application = { id: string; first_name: string; last_name: string; email: string; status: string; version: number };
export type SelectedApplication = { id: string; firstName: string; lastName: string; email: string; version: number };
const storageKey = "aero-selected-applications";

export function readSelection(): SelectedApplication[] {
  try { return JSON.parse(sessionStorage.getItem(storageKey) || "[]") as SelectedApplication[]; } catch { return []; }
}
function persistSelection(value: SelectedApplication[]) { sessionStorage.setItem(storageKey, JSON.stringify(value)); }
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
  const [busy, setBusy] = useState(false);
  const copy = operations.applications;
  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), q: appliedSearch, status });
    const response = await fetch(`/api/panel/applications?${params}`, { cache: "no-store" });
    if (!response.ok) { setMessage("Google Forms başvuruları yüklenemedi."); return; }
    const body = await response.json() as { items: Application[]; total: number };
    setItems(body.items); setTotal(body.total);
  }, [page, appliedSearch, status]);
  useEffect(() => { setSelection(readSelection()); void load(); }, [load]);
  function choose(next: SelectedApplication[]) { setSelection(next); persistSelection(next); }
  function toggle(item: Application) { choose(selection.some((row) => row.id === item.id) ? selection.filter((row) => row.id !== item.id) : [...selection, selectedOf(item)]); }
  function selectPage() { const map = new Map(selection.map((item) => [item.id, item])); items.filter((item) => item.status === "pending").forEach((item) => map.set(item.id, selectedOf(item))); choose([...map.values()]); }
  async function selectAllFiltered() {
    setBusy(true); setMessage(""); const map = new Map(selection.map((item) => [item.id, item]));
    for (let pageNumber = 1; pageNumber <= 200; pageNumber++) {
      const response = await fetch(`/api/panel/applications?${new URLSearchParams({ page: String(pageNumber), q: appliedSearch, status: "pending" })}`, { cache: "no-store" });
      if (!response.ok) { setMessage("Filtrelenen başvuruların tümü alınamadı."); break; }
      const body = await response.json() as { items: Application[]; total: number }; body.items.forEach((item) => map.set(item.id, selectedOf(item)));
      if (pageNumber * 50 >= body.total) break;
    }
    choose([...map.values()]); setBusy(false);
  }
  return <div className="ops-stack">
    <div className="ops-page-head"><div><h1>{copy.title}</h1><p>Google Forms üzerinden gelen başvuruları burada inceleyin ve toplu onay için seçin.</p></div><div className="ops-actions"><span className="ops-pill" data-tone="good">{selection.length} seçili</span><Link className="ops-button ops-button--primary" href="/panel/onay">Komite ve onay e-postası</Link></div></div>
    <section className="ops-card"><div className="ops-page-head"><div><h2>Google Forms başvuruları</h2><p className="ops-note">Yeni başvurular form bağlantısından gelir. Bu ekranda manuel kayıt veya Excel yapıştırma yoktur.</p></div><button onClick={() => void load()}>Yenile</button></div></section>
    {message && <p role="status" className="ops-note">{message}</p>}
    <section><div className="ops-toolbar"><label>İsim veya e-posta ara<input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { setPage(1); setAppliedSearch(search); } }} /></label><label>Durum<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="pending">Bekleyen</option><option value="approval_queued">Kuyrukta</option><option value="approved">Onaylı</option><option value="cancelled">İptal</option><option value="">Tümü</option></select></label><div className="ops-actions"><button onClick={() => { setPage(1); setAppliedSearch(search); }}>Ara</button><button onClick={selectPage}>Bu sayfayı seç</button><button disabled={busy} onClick={selectAllFiltered}>Filtrelenenlerin tümünü seç</button></div></div>
      {items.length ? <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Seç</th><th>Ad soyad</th><th>E-posta</th><th>Durum</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><input type="checkbox" aria-label={`${item.first_name} ${item.last_name} seç`} disabled={item.status !== "pending"} checked={selection.some((row) => row.id === item.id)} onChange={() => toggle(item)} /></td><td><strong>{item.first_name} {item.last_name}</strong></td><td>{item.email}</td><td><span className="ops-pill">{(operations.applicationStatus as Record<string, string>)[item.status] ?? item.status}</span></td></tr>)}</tbody></table></div> : <div className="ops-empty">Henüz Google Forms başvurusu yok.</div>}
      <div className="ops-pagination"><span>{total} kayıt · sayfa {page}</span><div className="ops-actions"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Önceki</button><button disabled={page * 50 >= total} onClick={() => setPage(page + 1)}>Sonraki</button></div></div>
    </section>
  </div>;
}
