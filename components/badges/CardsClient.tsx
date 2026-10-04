"use client";
/* QR images require the authenticated, non-cacheable endpoint directly. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { operations } from "@/lib/content";
import { useApproved } from "@/components/panel/useApproved";

export function CardsClient() {
  const { people, error, loading } = useApproved();
  const [selected, setSelected] = useState<string[]>([]);
  const list = selected.length ? people.filter((person) => selected.includes(person.id)) : people;
  return <div className="ops-stack"><div className="ops-page-head"><div><h1>{operations.cards.title}</h1><p>{operations.cards.description}</p></div><button className="ops-button--primary ops-print-hide" onClick={() => window.print()}>{operations.cards.print}</button></div>
    {error && <p role="alert" className="ops-error">{error}</p>}
    {loading&&<p role="status">Kartlar yükleniyor…</p>}
    {!people.length ? !loading&&!error&&<div className="ops-empty">{operations.cards.empty}</div> : <>
      <section className="ops-card ops-print-hide"><p className="ops-note">Hiç seçim yoksa bütün onaylı kartlar basılır. Kartlık ölçüsünü gerçek baskıdan önce kontrol edin.</p><div className="ops-actions"><button onClick={() => setSelected(people.map((person) => person.id))}>Tümünü seç</button><button onClick={() => setSelected([])}>Seçimi temizle</button></div>
        <div className="ops-grid">{people.map((person) => <label key={person.id}><span><input type="checkbox" checked={selected.includes(person.id)} onChange={() => setSelected(selected.includes(person.id) ? selected.filter((id) => id !== person.id) : [...selected, person.id])} /> {person.first_name} {person.last_name}</span></label>)}</div></section>
      <div className="ops-card-sheet">{list.map((person) => <article key={person.id} className="ops-badge"><div className="ops-badge-brand">AERO</div><div className="ops-badge-name">{person.first_name} {person.last_name}</div><div className="ops-badge-committee">{person.committee_name}</div><img src={`/api/panel/qr?id=${person.id}&format=svg`} alt={`${person.first_name} ${person.last_name} giriş QR kodu`} /><div className="ops-badge-code">{person.manual_code}</div></article>)}</div>
    </>}
  </div>;
}
