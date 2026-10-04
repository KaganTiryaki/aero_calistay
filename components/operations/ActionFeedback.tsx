"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import type { ActionFeedbackState } from "@/lib/operations/action-feedback";

export function ActionFeedback({ feedback, id, onDismiss, focus = false }: {
  feedback: ActionFeedbackState; id: string; onDismiss?: () => void; focus?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (focus) heading.current?.focus(); }, [feedback, focus]);
  return <section className="ops-feedback" data-kind={feedback.kind} aria-labelledby={id}>
    <div role={feedback.kind === "error" ? "alert" : "status"}>
      <h2 id={id} ref={heading} tabIndex={-1}>{feedback.kind === "success" && <span aria-hidden="true">✓ </span>}{feedback.title}</h2>
      {feedback.subject && <p className="ops-feedback-subject"><strong>{feedback.subject.name}</strong>{feedback.subject.email && <span>{feedback.subject.email}</span>}</p>}
      <p>{feedback.description}</p>
    </div>
    <div className="ops-actions">{feedback.links?.map(link => <Link key={link.href} className="ops-button" href={link.href}>{link.label}</Link>)}
      {onDismiss && <button type="button" onClick={onDismiss}>Kapat</button>}
    </div>
  </section>;
}
