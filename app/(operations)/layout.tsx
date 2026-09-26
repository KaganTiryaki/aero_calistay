import type { Metadata } from "next";
import "./operations.css";

export const metadata: Metadata = { robots: { index: false, follow: false }, title: "AERO Etkinlik Yönetimi" };

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  return <div className="ops">{children}</div>;
}
