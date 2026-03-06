import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Восстановление пароля</h1>
          <p className="mt-2 text-muted-foreground">
            Введите email для получения ссылки
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
