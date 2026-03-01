import { verifyEmailChange } from "@/lib/verification";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/auth";

export default async function VerifyNewEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <h1 className="text-xl font-semibold text-danger">Неверная ссылка</h1>
          <p className="mt-2 text-muted-foreground">
            Ссылка для смены email недействительна.
          </p>
          <Link href="/settings" className="mt-4 inline-block text-primary hover:underline">
            Вернуться в настройки
          </Link>
        </div>
      </div>
    );
  }

  const result = await verifyEmailChange(token);

  if (result.success) {
    await signOut({ redirect: false });
    redirect("/login?emailChanged=1");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <h1 className="text-xl font-semibold text-danger">Ошибка</h1>
        <p className="mt-2 text-muted-foreground">{result.error}</p>
        <Link href="/settings" className="mt-4 inline-block text-primary hover:underline">
          Вернуться в настройки
        </Link>
      </div>
    </div>
  );
}
