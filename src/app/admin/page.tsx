import { notFound } from "next/navigation";
import { isAdminAllowed, getRegistrationsByDay, getUsersActivity } from "./actions";
import { RegistrationsChart } from "@/components/admin/registrations-chart";
import { UsersActivityTable } from "@/components/admin/users-activity-table";

export default async function AdminPage() {
  const allowed = await isAdminAllowed();

  if (!allowed) {
    notFound();
  }

  const [registrations, usersActivity] = await Promise.all([
    getRegistrationsByDay(30),
    getUsersActivity(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">
        Админ-панель
      </h1>
      <div className="space-y-8">
        <RegistrationsChart initialData={registrations} />
        <UsersActivityTable data={usersActivity} />
      </div>
    </div>
  );
}
