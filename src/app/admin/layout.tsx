import { auth } from "@/auth";
import { AdminHeader } from "@/components/admin/admin-header";
import { isAdminAllowed } from "./actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const allowed = await isAdminAllowed();

  return (
    <div className="min-h-screen bg-background">
      {allowed && session?.user && <AdminHeader user={session.user} />}
      {children}
    </div>
  );
}
