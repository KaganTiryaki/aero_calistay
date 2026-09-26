"use client";

import Link from "next/link";
import { useState } from "react";
import { operations } from "@/lib/content";
import { useApproved } from "./useApproved";

export function ApprovedClient() {
  const { people, error, refresh } = useApproved();
  const [message, setMessage] = useState("");
  async function action(id: string, kind: "cancel" | "rotateQr") {
    const warning = kind === "cancel" ? "Onayı iptal edip kartı geçersizleştirmek istiyor musunuz?" : "Eski baskılar geçersiz olacak. QR yenilensin mi?";
    if (!window.confirm(warning)) return;
    const response = await fetch("/api/panel/application-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: kind }) });
    if (!response.ok) setMessage("İşlem tamamlanamadı."); else { setMessage(kind === "cancel" ? "Onay iptal edildi." : "QR yenilendi. Kartı yeniden basın."); await refresh(); }
  }
  return <div className="ops-stack"><div className="ops-page-head"><div><h1>{operations.approved.title}</h1><p>{operations.approved.description}</p></div><div className="ops-actions"><Link href="/panel/kartlar" className="ops-button">{operations.approved.card}</Link><a href="/api/panel/export" className="ops-button">{operations.approved.csv}</a></div></div>
    {error && <p role="alert" className="ops-error">{error}</p>}{message && <p role="status" className="ops-note">{message}</p>}
    {!people.length ? <div className="ops-empty">{operations.approved.empty}</div> : <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Ad soyad</th><th>Komite</th><th>Onay</th><th>E-posta</th><th>Giriş</th><th>QR</th><th>İşlem</th></tr></thead><tbody>{people.map((person) => <tr key={person.id}>
      <td><strong>{person.first_name} {person.last_name}</strong><small>{person.email}</small></td><td>{person.committee_name}</td>
      <td>{new Date(person.approved_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</td>
      <td><span className="ops-pill" data-tone={person.delivery_status === "delivered" ? "good" : person.delivery_status === "unknown" ? "wait" : "bad"}>{(operations.deliveryStatus as Record<string, string>)[person.delivery_status] ?? person.delivery_status}</span></td>
      <td>{person.checked_in_at ? new Date(person.checked_in_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "—"}</td>
      <td><div className="ops-actions"><a className="ops-button" href={`/api/panel/qr?id=${person.id}&format=svg`} download={`aero-${person.id}.svg`}>SVG</a><a className="ops-button" href={`/api/panel/qr?id=${person.id}&format=png`} download={`aero-${person.id}.png`}>PNG</a></div></td>
      <td><div className="ops-actions"><button onClick={() => action(person.id, "rotateQr")}>{operations.approved.rotate}</button><button className="ops-button--danger" onClick={() => action(person.id, "cancel")}>{operations.approved.cancel}</button></div></td>
    </tr>)}</tbody></table></div>}
  </div>;
}
