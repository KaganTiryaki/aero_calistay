"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { operations } from "@/lib/content";

type Committee = { id: string; name: string; active: boolean };
export function SettingsClient() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    const [committeeResponse, settingsResponse] = await Promise.all([
      fetch("/api/panel/committees", { cache: "no-store" }),
      fetch("/api/panel/settings", { cache: "no-store" }),
    ]);
    if (!committeeResponse.ok || !settingsResponse.ok) { setMessage("Ayarlar yüklenemedi."); return; }
    const committeeData = await committeeResponse.json() as { items: Committee[] };
    const settingsData = await settingsResponse.json() as { event: { check_in_open: boolean } };
    setCommittees(committeeData.items); setCheckInOpen(settingsData.event.check_in_open);
  }
  useEffect(() => { void load(); }, []);
  async function createCommittee(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/panel/committees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setMessage(response.ok ? "Komite eklendi." : "Komite eklenemedi.");
    if (response.ok) { setName(""); await load(); }
  }
  async function toggleCommittee(item: Committee) {
    const response = await fetch("/api/panel/committees", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, active: !item.active }) });
    setMessage(response.ok ? "Komite güncellendi." : "Komite güncellenemedi.");
    if (response.ok) await load();
  }
  async function toggleCheckIn() {
    const response = await fetch("/api/panel/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkInOpen: !checkInOpen }) });
    setMessage(response.ok ? "Giriş durumu güncellendi." : "Giriş durumu değiştirilemedi.");
    if (response.ok) await load();
  }
  return <div className="ops-stack"><div className="ops-page-head"><div><h1>{operations.settings.title}</h1><p>Komiteler ve etkinlik günü giriş ayarları.</p></div></div>
    {message && <p role="status" className="ops-note">{message}</p>}
    <div className="ops-grid"><section className="ops-card"><h2>{operations.settings.committees}</h2><form className="ops-actions" onSubmit={createCommittee}><label>Komite adı<input required value={name} onChange={(event) => setName(event.target.value)} /></label><button className="ops-button--primary">{operations.settings.newCommittee}</button></form>
      <div className="ops-stack">{committees.map((committee) => <div key={committee.id} className="ops-actions"><strong>{committee.name}</strong><span className="ops-pill" data-tone={committee.active ? "good" : "wait"}>{committee.active ? "Aktif" : "Pasif"}</span><button onClick={() => toggleCommittee(committee)}>{committee.active ? "Pasifleştir" : "Etkinleştir"}</button></div>)}</div></section>
      <section className="ops-card"><h2>Etkinlik girişi</h2><p className="ops-note">Giriş kapalıyken hiçbir QR veya manuel kod yeni giriş oluşturmaz.</p><p><span className="ops-pill" data-tone={checkInOpen ? "good" : "wait"}>{checkInOpen ? "Açık" : "Kapalı"}</span></p><button className={checkInOpen ? "ops-button--danger" : "ops-button--primary"} onClick={toggleCheckIn}>{checkInOpen ? operations.settings.checkInClosed : operations.settings.checkInOpen}</button></section></div>
    <section className="ops-card"><h2>Yönetici erişimi</h2>
      <p>Panel tek ortak yönetici şifresiyle açılır. Personel için giriş hesabı oluşturulmaz.</p>
      <p>Girişleri, IP ve cihaz izlerini <Link href="/panel/etkinlik">işlem geçmişinde</Link> görebilirsiniz.</p>
    </section>
  </div>;
}
