import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export default function VerifyEmailPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Подтверждение email</h1>
          <p className="mt-2 text-muted-foreground">
            Введите код из письма
          </p>
        </div>
        <VerifyEmailForm />
      </div>
    </div>
  );
}
