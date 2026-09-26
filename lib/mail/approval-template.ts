import { operations } from "../content.ts";

type ApprovalPerson = { firstName: string; lastName: string; committeeName: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

export function renderApprovalMail(person: ApprovalPerson): { subject: string; text: string; html: string } {
  const copy = operations.mail;
  const name = `${person.firstName} ${person.lastName}`;
  const text = `${copy.greeting} ${name},\n\n${copy.acceptanceBefore} ${person.committeeName} ${copy.acceptanceAfter}\n\n${copy.welcome}\n\n${copy.signature}`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#102128"><p>${copy.greeting} ${escapeHtml(name)},</p><p>${copy.acceptanceBefore} <strong>${escapeHtml(person.committeeName)}</strong> ${copy.acceptanceAfter}</p><p>${copy.welcome}</p><p>${copy.signature}</p></div>`;
  return { subject: copy.subject, text, html };
}
