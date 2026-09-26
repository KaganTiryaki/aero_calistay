"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { operations } from "@/lib/content";
import { parsePastedApplications } from "@/lib/applications/validation";

type Application = { id: string; first_name: string; last_name: string; email: string; status: string; version: number };
export type SelectedApplication = { id: string; firstName: string; lastName: string; email: string; version: number };
const storageKey = "aero-selected-applications";

export function readSelection(): SelectedApplication[] {
  try { return JSON.parse(sessionStorage.getItem(storageKey) || "[]") as SelectedApplication[]; } catch { return []; }
}

function persistSelection(value: SelectedApplication[]) { sessionStorage.setItem(storageKey, JSON.stringify(value)); }
function selectedOf(item: Application): SelectedApplication {
  return { id: item.id, firstName: item.first_name, lastName: item.last_name, email: item.email, version: item.version };
}

export function ApplicationsClient() {
  const [items, setItems] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("pending");
  const [selection, setSelection] = useState<SelectedApplication[]>([]);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "" });
  const [editing, setEditing] = useState<{ id: string; version: number } | null>(null);
  const [pasted, setPasted] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = operations.applications;
  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), q: appliedSearch, status });
    const response = await fetch(`/api/panel/applications?${params}`, { cache: "no-store" });
    if (!response.ok) { setMessage("Liste yüklenemedi."); return; }
    const body = await response.json() as { items: Application[]; total: number };
    setItems(body.items); setTotal(body.total);
  }, [page, appliedSearch, status]);
  useEffect(() => { setSelection(readSelection()); void load(); }, [load]);

  function choose(next: SelectedApplication[]) { setSelection(next); persistSelection(next); }
  function toggle(item: Application) {
    choose(selection.some((row) => row.id === item.id)
      ? selection.filter((row) => row.id !== item.id) : [...selection, selectedOf(item)]);
  }
  function selectPage() {
    const map = new Map(selection.map((item) => [item.id, item]));
    items.filter((item) => item.status === "pending").forEach((item) => map.set(item.id, selectedOf(item)));
    choose([...map.values()]);
  }
  async function selectAllFiltered() {
    setBusy(true); setMessage("");
    const map = new Map(selection.map((item) => [item.id, item]));
    for (let pageNumber = 1; pageNumber <= 200; pageNumber++) {
      const params = new URLSearchParams({ page: String(pageNumber), q: appliedSearch, status: "pending" });
      const response = await fetch(`/api/panel/applications?${params}`, { cache: "no-store" });
      if (!response.ok) { setMessage("Filtrelenen kişilerin tümü alınamadı."); break; }
      const body = await response.json() as { items: Application[]; total: number };
      body.items.forEach((item) => map.set(item.id, selectedOf(item)));
      if (pageNumber * 50 >= body.total) break;
    }
    choose([...map.values()]); setBusy(false);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/panel/applications", {
      method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, ...editing }),
    });
    const body = await response.json() as { error?: string };
    if (!response.ok) setMessage(body.error || "Kayıt yapılamadı.");
    else { setForm({ firstName: "", lastName: "", email: "" }); setEditing(null); setMessage("Başvuru kaydedildi."); await load(); }
    setBusy(false);
  }
  async function savePaste() {
    const parsed = parsePastedApplications(pasted);
    if (!parsed.valid.length) { setMessage("Kaydedilecek geçerli satır yok."); return; }
    setBusy(true);
    let saved = 0;
    const failures = parsed.errors.map((error) => `${error.line}. satır: ${error.reason}`);
    try {
      for (const item of parsed.valid) {
        const response = await fetch("/api/panel/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
        if (response.ok) saved++;
        else {
          const body = await response.json() as { error?: string };
          failures.push(`${item.email}: ${body.error ?? "Kayıt yapılamadı."}`);
        }
      }
      setMessage(`${saved} kişi eklendi; ${failures.length} satır eklenmedi.${failures.length ? ` ${failures.slice(0, 10).join(" · ")}${failures.length > 10 ? " · …" : ""}` : ""}`);
    } catch {
      setMessage(`${saved} kişinin kaydı doğrulandı; bağlantı kesildi. Listeyi kontrol edip kalanları tekrar deneyin.`);
    } finally {
      setBusy(false); await load();
    }
  }
  const preview = parsePastedApplications(pasted);
  return <div className="ops-stack">
    <div className="ops-page-head"><div><h1>{copy.title}</h1><p>{copy.description}</p></div><div className="ops-actions"><span className="ops-pill" data-tone="good">{selection.length} seçili</span><Link className="ops-button ops-button--primary" href="/panel/onay">{copy.toApproval}</Link></div></div>
    <div className="ops-grid">
      <section className="ops-card"><h2>{editing ? "Başvuruyu düzenle" : copy.add}</h2><form className="ops-form" onSubmit={save}>
        <div className="ops-form-row"><label>{copy.firstName}<input required maxLength={120} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
        <label>{copy.lastName}<input required maxLength={120} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
        <label>{copy.email}<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></div>
        <div className="ops-actions"><button className="ops-button--primary" disabled={busy} type="submit">{copy.save}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm({ firstName: "", lastName: "", email: "" }); }}>Vazgeç</button>}</div>
      </form></section>
      <section className="ops-card"><h2>{copy.paste}</h2><p className="ops-note">Ad, soyad ve e-posta sütunlarını Excel’den kopyalayıp yapıştırın. Önce satırları kontrol edin.</p>
        <textarea aria-label={copy.paste} value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder="Ad\tSoyad\tE-posta" />
        {pasted && <p className="ops-note">{preview.valid.length} geçerli, {preview.errors.length} hatalı satır.{preview.errors.slice(0, 3).map((error) => ` ${error.line}. satır: ${error.reason}`)}</p>}
        <button disabled={busy || !preview.valid.length} onClick={savePaste}>{copy.save}</button>
      </section>
    </div>
    {message && <p role="status" className="ops-note">{message}</p>}
    <section><div className="ops-toolbar"><label>{copy.search}<input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { setPage(1); setAppliedSearch(search); } }} /></label>
      <label>Durum<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="pending">Bekleyen</option><option value="approval_queued">Kuyrukta</option><option value="approved">Onaylı</option><option value="cancelled">İptal</option><option value="">Tümü</option></select></label>
      <div className="ops-actions"><button onClick={() => { setPage(1); setAppliedSearch(search); }}>Ara</button><button onClick={selectPage}>{copy.selectPage}</button><button disabled={busy} onClick={selectAllFiltered}>{copy.selectAll}</button></div></div>
      {items.length ? <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Seç</th><th>Ad soyad</th><th>E-posta</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}>
        <td><input type="checkbox" aria-label={`${item.first_name} ${item.last_name} seç`} disabled={item.status !== "pending"} checked={selection.some((row) => row.id === item.id)} onChange={() => toggle(item)} /></td>
        <td><strong>{item.first_name} {item.last_name}</strong></td><td>{item.email}</td><td><span className="ops-pill">{(operations.applicationStatus as Record<string, string>)[item.status] ?? item.status}</span></td>
        <td><button disabled={item.status !== "pending"} onClick={() => { setEditing({ id: item.id, version: item.version }); setForm({ firstName: item.first_name, lastName: item.last_name, email: item.email }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Düzenle</button></td>
      </tr>)}</tbody></table></div> : <div className="ops-empty">{copy.empty}</div>}
      <div className="ops-pagination"><span>{total} kayıt · sayfa {page}</span><div className="ops-actions"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Önceki</button><button disabled={page * 50 >= total} onClick={() => setPage(page + 1)}>Sonraki</button></div></div>
    </section>
  </div>;
}
