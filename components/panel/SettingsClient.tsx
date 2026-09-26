"use client";

import { useEffect, useState, type FormEvent } from "react";
import { operations } from "@/lib/content";

type Committee = { id: string; name: string; active: boolean };
type Staff = { user_id: string; role: string; active: boolean; email?: string };
export function SettingsClient() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [message, setMessage] = useState("");
  async function load() {
    const [committeeResponse, staffResponse, settingsResponse] = await Promise.all([
      fetch("/api/panel/committees", { cache: "no-store" }),
      fetch("/api/panel/staff", { cache: "no-store" }),
      fetch("/api/panel/settings", { cache: "no-store" }),
    ]);
    if (!committeeResponse.ok || !staffResponse.ok || !settingsResponse.ok) { setMessage("Ayarlar yüklenemedi."); return; }
    const committeeData = await committeeResponse.json() as { items: Committee[] };
    const staffData = await staffResponse.json() as { items: Staff[] };
    const settingsData = await settingsResponse.json() as { event: { check_in_open: boolean } };
    setCommittees(committeeData.items); setStaff(staffData.items); setCheckInOpen(settingsData.event.check_in_open);
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
  async function invite(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/panel/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
    if (response.ok) {
      const body = await response.json() as { invitationSent: boolean };
      setMessage(body.invitationSent ? "Davet gönderildi." : "Mevcut hesap personel olarak yetkilendirildi. İlk davet e-postasını kontrol edin.");
    } else setMessage("Personel eklenemedi. SMTP ve hesap ayarlarını kontrol edin.");
    if (response.ok) { setEmail(""); await load(); }
  }
  async function toggleStaff(item: Staff) {
    const response = await fetch("/api/panel/staff", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: item.user_id, active: !item.active }) });
    setMessage(response.ok ? "Personel durumu güncellendi." : "Personel güncellenemedi.");
    if (response.ok) await load();
  }
  return <div className="ops-stack"><div className="ops-page-head"><div><h1>{operations.settings.title}</h1><p>Etkinlik komiteleri, görevli hesapları ve giriş durumu.</p></div></div>
    {message && <p role="status" className="ops-note">{message}</p>}
    <div className="ops-grid"><section className="ops-card"><h2>{operations.settings.committees}</h2><form className="ops-actions" onSubmit={createCommittee}><label>Komite adı<input required value={name} onChange={(event) => setName(event.target.value)} /></label><button className="ops-button--primary">{operations.settings.newCommittee}</button></form>
      <div className="ops-stack">{committees.map((committee) => <div key={committee.id} className="ops-actions"><strong>{committee.name}</strong><span className="ops-pill" data-tone={committee.active ? "good" : "wait"}>{committee.active ? "Aktif" : "Pasif"}</span><button onClick={() => toggleCommittee(committee)}>{committee.active ? "Pasifleştir" : "Etkinleştir"}</button></div>)}</div></section>
      <section className="ops-card"><h2>Etkinlik girişi</h2><p className="ops-note">Giriş kapalıyken hiçbir QR veya manuel kod yeni giriş oluşturmaz.</p><p><span className="ops-pill" data-tone={checkInOpen ? "good" : "wait"}>{checkInOpen ? "Açık" : "Kapalı"}</span></p><button className={checkInOpen ? "ops-button--danger" : "ops-button--primary"} onClick={toggleCheckIn}>{checkInOpen ? operations.settings.checkInClosed : operations.settings.checkInOpen}</button></section></div>
    <section className="ops-card"><h2>{operations.settings.staff}</h2><form className="ops-actions" onSubmit={invite}><label>E-posta<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Rol<select value={role} onChange={(event) => setRole(event.target.value as "admin" | "staff")}><option value="staff">Görevli</option><option value="admin">Yönetici</option></select></label><button className="ops-button--primary">{operations.settings.invite}</button></form>
      <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Hesap</th><th>Rol</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>{staff.map((person) => <tr key={person.user_id}><td>{person.email ?? person.user_id}</td><td>{person.role}</td><td>{person.active ? "Aktif" : "Pasif"}</td><td><button onClick={() => toggleStaff(person)}>{person.active ? "Pasifleştir" : "Etkinleştir"}</button></td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
