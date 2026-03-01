import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">ФинПилот</h1>
          <p className="mt-2 text-muted-foreground">
            Создайте аккаунт за 2 минуты
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
