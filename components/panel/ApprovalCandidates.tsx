import type { ApprovalPerson } from "@/lib/panel/approval-selection";

export function ApprovalCandidates({items,selectedIds,disabled,onToggle}:{
  items:ApprovalPerson[];selectedIds:Set<string>;disabled:boolean;onToggle:(person:ApprovalPerson)=>void;
}) {
  return <div className="ops-person-list">{items.map((person)=><article className="ops-person" data-selected={selectedIds.has(person.id)} key={person.id}>
    <div className="ops-person-details"><strong>{person.firstName} {person.lastName}</strong><span>{person.email}</span></div>
    <button type="button" disabled={disabled} aria-pressed={selectedIds.has(person.id)} onClick={()=>onToggle(person)}>
      {selectedIds.has(person.id)?"✓ Seçildi · Kaldır":"Bu adayı seç"}
    </button>
  </article>)}</div>;
}
