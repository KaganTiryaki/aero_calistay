"use client";
import { useState, useEffect, type FormEvent } from "react";
import { operations } from "@/lib/content";
type Meal = { id: string; name: string; opens_at: string; closes_at: string; active: boolean };
export function MealsClient() {
  const copy = operations.meals; const [items, setItems] = useState<Meal[]>([]); const [name, setName] = useState(""); const [opens, setOpens] = useState(""); const [closes, setCloses] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    try { const response = await fetch("/api/panel/meals", { cache: "no-store" }); if (!response.ok) throw new Error(); setItems((await response.json()).items); }
    catch { setMessage(operations.participant.error); }
  }
  useEffect(() => { void load(); }, []);
  async function change(body: unknown, method: string) {
    setBusy(true);
    try { const response = await fetch("/api/panel/meals", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setMessage(copy.saved); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : operations.participant.error); } setBusy(false);
  }
  async function add(event: FormEvent) { event.preventDefault(); await change({ name, opensAt: new Date(opens).toISOString(), closesAt: new Date(closes).toISOString() }, "POST"); }
  return <div className="ops-stack"><h1>{copy.title}</h1><p>{copy.help}</p>{message && <p role="status">{message}</p>}
    <section className="ops-card"><form className="ops-form" onSubmit={add}><label>{copy.name}<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>{copy.opens}<input required type="datetime-local" value={opens} onChange={(event) => setOpens(event.target.value)} /></label><label>{copy.closes}<input required type="datetime-local" value={closes} onChange={(event) => setCloses(event.target.value)} /></label><button disabled={busy}>{copy.add}</button></form></section>
    {items.map((meal) => <section className="ops-card" key={meal.id}><h2>{meal.name}</h2><p>{new Date(meal.opens_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} — {new Date(meal.closes_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</p><p>{meal.active ? copy.active : copy.inactive}</p><button disabled={busy} onClick={() => change({ id: meal.id, active: !meal.active }, "PATCH")}>{meal.active ? copy.close : copy.open}</button></section>)}
  </div>;
}
