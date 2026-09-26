"use client";
import { useCallback, useEffect, useState } from "react";

export type ApprovedPerson = { id: string; first_name: string; last_name: string; email: string; committee_name: string; approved_at: string; manual_code: string; checked_in_at: string | null; delivery_status: string };

export function useApproved() {
  const [people, setPeople] = useState<ApprovedPerson[]>([]);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const all: ApprovedPerson[] = [];
      for (let page = 1; page <= 10000; page++) {
        const response = await fetch(`/api/panel/approved?page=${page}`, { cache: "no-store" });
        if (!response.ok) throw new Error("fetch");
        const body = await response.json() as { items: ApprovedPerson[]; hasMore: boolean };
        all.push(...body.items);
        if (!body.hasMore) { setPeople(all); setError(""); return; }
      }
      throw new Error("pagination");
    } catch { setError("Onaylılar yüklenemedi."); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { people, error, refresh };
}
