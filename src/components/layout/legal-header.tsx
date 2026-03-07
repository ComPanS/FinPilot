import { auth } from "@/auth";
import { LegalHeaderClient } from "./legal-header-client";

export async function LegalHeader() {
  const session = await auth();
  return <LegalHeaderClient session={session} />;
}
