import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">ФинПилот</h1>
          <p className="mt-2 text-muted-foreground">
            Войдите в свой аккаунт
          </p>
        </div>
        <Suspense fallback={<div className="rounded-xl border border-border bg-surface p-6">Загрузка...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
