"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type ApprovedPerson = { id: string; first_name: string; last_name: string; email: string; committee_name: string; approved_at: string; manual_code: string; checked_in_at: string | null; email_status: { label: string; tone: "good" | "wait" | "bad" | "neutral"; detail: string | null } };

export function useApproved() {
  const [people, setPeople] = useState<ApprovedPerson[]>([]);
  const [error, setError] = useState("");
  const [loading,setLoading]=useState(true);const [hasLoaded,setHasLoaded]=useState(false);const request=useRef(0);
  const refresh = useCallback(async () => {
    const current=++request.current;setLoading(true);
    try {
      const all: ApprovedPerson[] = [];
      for (let page = 1; page <= 10000; page++) {
        const response = await fetch(`/api/panel/approved?page=${page}`, { cache: "no-store" });
        if (!response.ok) throw new Error("fetch");
        const body = await response.json() as { items: ApprovedPerson[]; hasMore: boolean };
        all.push(...body.items);
        if(current!==request.current)return false;
        if (!body.hasMore) { setPeople(all); setError("");setHasLoaded(true); return true; }
      }
      throw new Error("pagination");
    } catch { if(current===request.current)setError("Kesin kabul listesi yüklenemedi. Listeyi yenileyin.");return false; }
    finally{if(current===request.current)setLoading(false);}
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { people, error, refresh, loading, hasLoaded };
}
