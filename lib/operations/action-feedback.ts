export type ActionFeedbackState = {
  kind: "success" | "error" | "info" | "uncertain";
  title: string;
  description: string;
  subject?: { name: string; email?: string };
  links?: { label: string; href: string }[];
};
export function refreshFailureAfterAction(feedback: ActionFeedbackState | null): string {
  return feedback?.kind === "success"
    ? "İşlem tamamlandı; liste yenilenemedi. Listeyi tekrar yenileyin."
    : "Liste yüklenemedi. Tekrar deneyin.";
}
