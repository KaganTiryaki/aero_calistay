import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/permissions";
import { ScannerClient } from "@/components/check-in/ScannerClient";
export default async function ScanPage() {
  if (!await getStaffContext()) redirect("/personel/giris");
  return <ScannerClient />;
}
