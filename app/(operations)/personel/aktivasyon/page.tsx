import type { Metadata } from "next";
import { ParticipantAuthClient } from "@/components/participant/AuthClient";
export const metadata: Metadata = { referrer: "no-referrer" };
export default function StaffActivationPage() { return <ParticipantAuthClient mode="staff-activate" />; }
