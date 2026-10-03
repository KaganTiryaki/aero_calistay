import type { Metadata } from "next";
import { ParticipantAuthClient } from "@/components/participant/AuthClient";
export const metadata: Metadata = { referrer: "no-referrer" };
export default function ParticipantActivationPage() { return <ParticipantAuthClient mode="activate" />; }
