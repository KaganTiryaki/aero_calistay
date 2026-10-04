export type ApprovalPerson = {id:string;firstName:string;lastName:string;email:string;version:number};
export type ApprovalDraft = {committeeId:string;people:ApprovalPerson[]};
export const approvalDraftKey = "aero-approval-draft-v2";
export const approvalAttemptKey = "aero-approval-attempt-v2";
export const emptyApprovalDraft:ApprovalDraft = {committeeId:"",people:[]};

export function changeCommittee(draft:ApprovalDraft,committeeId:string):ApprovalDraft {
  return draft.committeeId===committeeId?draft:{committeeId,people:[]};
}

export function toggleCandidate(draft:ApprovalDraft,person:ApprovalPerson):ApprovalDraft {
  if(draft.people.some((item)=>item.id===person.id))return {...draft,people:draft.people.filter((item)=>item.id!==person.id)};
  if(draft.people.length>=500)throw new Error("Bir gönderimde en fazla 500 aday seçebilirsiniz.");
  return {...draft,people:[...draft.people,person]};
}

export function toSelections(draft:ApprovalDraft) {
  if(!draft.committeeId)throw new Error("Önce komite seçin.");
  if(!draft.people.length)throw new Error("En az bir aday seçin.");
  if(draft.people.length>500)throw new Error("Bir gönderimde en fazla 500 aday seçebilirsiniz.");
  if(new Set(draft.people.map((person)=>person.id)).size!==draft.people.length)throw new Error("Aynı aday iki kez seçilemez.");
  return draft.people.map((person)=>({applicationId:person.id,version:person.version,committeeId:draft.committeeId}));
}

export function readApprovalDraft(storage:Pick<Storage,"getItem">=sessionStorage):ApprovalDraft {
  try {
    const value:unknown=JSON.parse(storage.getItem(approvalDraftKey)??"null");
    if(!value||typeof value!=="object")return emptyApprovalDraft;
    const draft=value as Partial<ApprovalDraft>;
    if(typeof draft.committeeId!=="string"||!Array.isArray(draft.people))return emptyApprovalDraft;
    const people=draft.people.filter((item):item is ApprovalPerson=>typeof item?.id==="string"&&typeof item.firstName==="string"&&typeof item.lastName==="string"&&typeof item.email==="string"&&Number.isSafeInteger(item.version)&&item.version>0);
    return {committeeId:draft.committeeId,people:people.slice(0,500)};
  }catch{return emptyApprovalDraft;}
}

export function persistApprovalDraft(draft:ApprovalDraft,storage:Pick<Storage,"setItem">=sessionStorage) {
  storage.setItem(approvalDraftKey,JSON.stringify(draft));
}
