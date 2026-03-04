import { verifyPasswordResetToken } from "@/lib/verification";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="rounded-xl border border-border bg-surface p-6 text-center">
            <h1 className="text-xl font-semibold text-danger">
              Неверная ссылка
            </h1>
            <p className="mt-2 text-muted-foreground">
              Ссылка для восстановления пароля недействительна.
            </p>
            <Link
              href="/forgot-password"
              className="mt-4 inline-block text-primary hover:underline"
            >
              Запросить новую ссылку
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const result = await verifyPasswordResetToken(token);

  if (!result.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="rounded-xl border border-border bg-surface p-6 text-center">
            <h1 className="text-xl font-semibold text-danger">Ошибка</h1>
            <p className="mt-2 text-muted-foreground">{result.error}</p>
            <Link
              href="/forgot-password"
              className="mt-4 inline-block text-primary hover:underline"
            >
              Запросить новую ссылку
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            Новый пароль
          </h1>
          <p className="mt-2 text-muted-foreground">
            Введите новый пароль для входа
          </p>
        </div>
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
