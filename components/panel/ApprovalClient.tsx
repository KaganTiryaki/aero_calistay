"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { operations } from "@/lib/content";
import { renderApprovalMail } from "@/lib/mail/approval-template";
import { readSelection, type SelectedApplication } from "./ApplicationsClient";

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
      .then((body: { items: Committee[] }) => setCommittees(body.items.filter((item) => item.active)));
  }, []);
  function assignEveryone() {
    if (!common) return;
    setAssigned(Object.fromEntries(people.map((person) => [person.id, common])));
  }
  async function queue() {
    if (people.some((person) => !assigned[person.id])) { setMessage("Her kişi için komite seçin."); return; }
    setBusy(true); setMessage("");
    let queued = 0;
    for (let offset = 0; offset < people.length; offset += 500) {
      const chunk = people.slice(offset, offset + 500);
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
        setMessage(`${queued} kişi kuyruğa alındığı doğrulandı. Bağlantıyı kontrol edip aynı seçimi tekrar deneyin.`);
        break;
      }
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        setMessage(`${queued} kişi kuyruğa alındı. ${body.error || "Kalan kişiler eklenemedi."}`);
        break;
      }
      sessionStorage.removeItem(attemptKey);
      queued += chunk.length;
    }
    if (queued) {
      const remaining = people.slice(queued);
      sessionStorage.setItem("aero-selected-applications", JSON.stringify(remaining));
      setPeople(remaining);
      if (!remaining.length) setMessage(`${queued} kişi kalıcı gönderim kuyruğuna alındı. İlerlemeyi Gönderimler bölümünden izleyin.`);
    }
    setBusy(false);
  }
  const first = people.find((person) => assigned[person.id]);
  const preview = first ? renderApprovalMail({ firstName: first.firstName, lastName: first.lastName,
    committeeName: committees.find((committee) => committee.id === assigned[first.id])?.name ?? "" }) : null;
  return <div className="ops-stack"><div className="ops-page-head"><div><h1>{operations.approval.title}</h1><p>{operations.approval.description}</p></div><span className="ops-pill" data-tone="good">{people.length} kişi</span></div>
    {people.length ? <>
      <section className="ops-card"><div className="ops-actions"><label>{operations.approval.allCommittee}<select value={common} onChange={(event) => setCommon(event.target.value)}><option value="">Komite seçin</option>{committees.map((committee) => <option key={committee.id} value={committee.id}>{committee.name}</option>)}</select></label><button onClick={assignEveryone}>Uygula</button></div></section>
      <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Ad soyad</th><th>E-posta</th><th>{operations.approval.committee}</th></tr></thead><tbody>{people.map((person) => <tr key={person.id}><td><strong>{person.firstName} {person.lastName}</strong></td><td>{person.email}</td><td><select aria-label={`${person.firstName} ${person.lastName} komitesi`} value={assigned[person.id] ?? ""} onChange={(event) => setAssigned({ ...assigned, [person.id]: event.target.value })}><option value="">Komite seçin</option>{committees.map((committee) => <option key={committee.id} value={committee.id}>{committee.name}</option>)}</select></td></tr>)}</tbody></table></div>
      <section className="ops-card"><h2>{operations.approval.preview}</h2>{preview ? <><strong>{preview.subject}</strong><div className="ops-preview">{preview.text}</div></> : <p className="ops-note">Önizleme için bir komite seçin.</p>}</section>
      {message && <p role="status" className="ops-note">{message}</p>}
      <div className="ops-actions ops-actions--end"><button className="ops-button--primary" disabled={busy || people.some((person) => !assigned[person.id])} onClick={queue}>{operations.approval.send}</button></div>
    </> : <div className="ops-empty">{operations.approval.empty} <Link href="/panel/basvurular">Başvurulara dön</Link></div>}
  </div>;
}
