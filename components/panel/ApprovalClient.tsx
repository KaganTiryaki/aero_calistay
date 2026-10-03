"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { operations } from "@/lib/content";
import { renderApprovalMail } from "@/lib/mail/approval-template";
import { persistSelection, readSelection, type SelectedApplication } from "./ApplicationsClient";

type Committee = { id: string; name: string; active: boolean };
export function ApprovalClient() {
  const [people, setPeople] = useState<SelectedApplication[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [common, setCommon] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setPeople(readSelection());
    void fetch("/api/panel/committees", { cache: "no-store" }).then((response) => response.json())
      .then((body: { items: Committee[] }) => setCommittees(body.items.filter((item) => item.active)))
      .catch(() => setMessage("Komiteler yüklenemedi. Sayfayı yenileyin."));
  }, []);
  function removePerson(id: string) {
    const next = people.filter((person) => person.id !== id);
    setPeople(next); persistSelection(next);
    setAssigned((current) => { const updated = { ...current }; delete updated[id]; return updated; });
    setMessage("");
  }
  function clearPeople() { setPeople([]); persistSelection([]); setAssigned({}); setMessage(""); }
  function assignEveryone() {
    if (!common) return;
    setAssigned(Object.fromEntries(people.map((person) => [person.id, common])));
  }
  async function send() {
    if (people.some((person) => !assigned[person.id])) { setMessage("Her kişi için komite seçin."); return; }
    setBusy(true); setMessage("");
    let handled = 0; let providerAccepted = 0; let interrupted = false;
    for (let offset = 0; offset < people.length; offset += 3) {
      const chunk = people.slice(offset, offset + 3);
      const selections = chunk.map((person) => ({
          applicationId: person.id, version: person.version, committeeId: assigned[person.id],
        }));
      const attemptKey = `aero-approval-attempt:${chunk[0].id}`;
      const signature = JSON.stringify(selections);
      let attempt: { signature: string; batchId: string } | null = null;
      try { attempt = JSON.parse(sessionStorage.getItem(attemptKey) ?? "null"); } catch { /* New attempt below. */ }
      if (!attempt || attempt.signature !== signature) {
        attempt = { signature, batchId: crypto.randomUUID() };
        sessionStorage.setItem(attemptKey, JSON.stringify(attempt));
      }
      let response: Response;
      try {
        response = await fetch("/api/panel/batches", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId: attempt.batchId, selections }),
        });
      } catch {
        setMessage(`${handled} kişinin işlemi doğrulandı. Son grubun sonucu belirsiz; bağlantıyı kontrol edip aynı seçimi tekrar deneyin.`);
        interrupted = true;
        break;
      }
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        setMessage(`${handled} kişinin işlemi doğrulandı. ${body.error || "Kalan kişilerin e-postası gönderilemedi."}`);
        interrupted = true;
        break;
      }
      let outcome: { providerAccepted: number; failed: number; unresolved: number; dispatchReady: boolean; firstError: string | null };
      try { outcome = await response.json(); }
      catch { setMessage(`${handled} kişinin işlemi doğrulandı. Son grubun sonucunu Gönderimler bölümünden kontrol edip aynı seçimi tekrar deneyin.`); interrupted = true; break; }
      sessionStorage.removeItem(attemptKey);
      handled += chunk.length; providerAccepted += outcome.providerAccepted;
      if (outcome.failed || outcome.unresolved || !outcome.dispatchReady) {
        setMessage(`${providerAccepted} e-posta Brevo tarafından kabul edildi; ${outcome.failed} hatalı, ${outcome.unresolved} sonuç bekliyor. ${outcome.firstError ?? "Ayrıntıları Gönderimler bölümünden kontrol edin."}`);
        interrupted = true;
        break;
      }
    }
    if (handled) {
      const remaining = people.slice(handled);
      persistSelection(remaining);
      setPeople(remaining);
      if (!interrupted && !remaining.length) setMessage(`${providerAccepted} e-posta Brevo tarafından kabul edildi. Gelen kutusuna teslimat durumunu Gönderimler bölümünden izleyin.`);
    }
    setBusy(false);
  }
  const first = people.find((person) => assigned[person.id]);
  const preview = first ? renderApprovalMail({ firstName: first.firstName, lastName: first.lastName,
    committeeName: committees.find((committee) => committee.id === assigned[first.id])?.name ?? "" }) : null;
  return <div className="ops-stack"><div className="ops-page-head"><div><h1>{operations.approval.title}</h1><p>Seçilen kişilerin komitesini belirleyin. Göndermeden önce listeyi kontrol edin.</p></div><span className="ops-pill" data-tone="good">{people.length} kişi</span></div>
    {people.length ? <>
      <div className="ops-step" aria-label="İşlem sırası"><span>1. Kişileri seç</span><span>→</span><strong>2. Komiteyi belirle ve e-postayı gönder</strong></div>
      <section className="ops-card"><div className="ops-page-head"><div><h2>Seçilen kişiler</h2><p>Yanlış kişiyi seçtiyseniz yanındaki Kaldır düğmesine basın.</p></div><div className="ops-actions"><Link className="ops-button" href="/panel/basvurular">Başvurulara dön</Link><button type="button" onClick={clearPeople}>Tüm seçimi kaldır</button></div></div>
        {people.length > 1 && <div className="ops-toolbar"><label>Herkese aynı komiteyi ata<select value={common} onChange={(event) => setCommon(event.target.value)}><option value="">Komite seçin</option>{committees.map((committee) => <option key={committee.id} value={committee.id}>{committee.name}</option>)}</select></label><button type="button" disabled={!common} onClick={assignEveryone}>Herkese uygula</button></div>}
        {!committees.length && <p role="alert" className="ops-error">Aktif komite yok. Önce <Link href="/panel/ayarlar">Ayarlar bölümünden komite ekleyin</Link>.</p>}
        <div className="ops-person-list">{people.map((person) => <div className="ops-person" key={person.id}><div className="ops-person-details"><strong>{person.firstName} {person.lastName}</strong><span>{person.email}</span></div><label className="ops-committee-choice">Komite<select aria-label={`${person.firstName} ${person.lastName} komitesi`} value={assigned[person.id] ?? ""} onChange={(event) => setAssigned({ ...assigned, [person.id]: event.target.value })}><option value="">Komite seçin</option>{committees.map((committee) => <option key={committee.id} value={committee.id}>{committee.name}</option>)}</select></label><button type="button" onClick={() => removePerson(person.id)} aria-label={`${person.firstName} ${person.lastName} seçimini kaldır`}>Kaldır</button></div>)}</div>
      </section>
      <section className="ops-card"><h2>{operations.approval.preview}</h2>{preview ? <><strong>{preview.subject}</strong><div className="ops-preview">{preview.text}</div></> : <p className="ops-note">Önizleme için bir komite seçin.</p>}</section>
      {message && <p role="status" className="ops-note">{message}</p>}
      <div className="ops-actions ops-actions--end"><button className="ops-button--primary" disabled={busy || !committees.length || people.some((person) => !assigned[person.id])} onClick={send}>{busy ? "E-postalar gönderiliyor…" : `${people.length} kişinin kabul e-postasını gönder`}</button></div>
    </> : <div className="ops-empty"><p>Henüz kimse seçilmedi.</p><p>Başvurular bölümünde onaylamak istediğiniz kişinin yanındaki “Bu kişiyi seç” düğmesine basın.</p><Link className="ops-button ops-button--primary" href="/panel/basvurular">Başvurulara git</Link></div>}
  </div>;
}
