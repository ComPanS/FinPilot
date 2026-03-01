"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { verifyEmailAction, resendVerificationAction } from "@/app/actions/auth";

const schema = z.object({
  code: z.string().length(6, "Код из 6 цифр"),
});

type FormData = z.infer<typeof schema>;

function VerifyEmailFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
  });

  async function onSubmit(data: FormData) {
    if (!emailParam) {
      setError("Email не указан");
      return;
    }
    setError(null);
    const result = await verifyEmailAction(emailParam, data.code);
    if (result?.error) {
      setError(result.error);
      return;
    }
    const pending = typeof window !== "undefined" ? sessionStorage.getItem("pending_register") : null;
    let parsed: { email?: string; password?: string } = {};
    if (pending) {
      try {
        parsed = JSON.parse(pending);
        sessionStorage.removeItem("pending_register");
      } catch {}
    }
    const password = parsed.password;
    if (password) {
      const signInResult = await signIn("credentials", {
        email: emailParam,
        password,
        redirect: false,
      });
      if (signInResult?.error) {
        router.push("/login?verified=1");
        router.refresh();
        return;
      }
      router.push("/onboarding");
      router.refresh();
    } else {
      router.push("/login?verified=1");
      router.refresh();
    }
  }

  async function onResend() {
    if (!emailParam) return;
    setResending(true);
    setResendSuccess(false);
    const result = await resendVerificationAction(emailParam);
    setResending(false);
    if (result?.error) setError(result.error);
    else setResendSuccess(true);
  }

  function onBack() {
    router.push("/register");
  }

  if (!emailParam) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-md">
        <p className="text-muted-foreground">Email не указан.</p>
        <Link href="/register" className="mt-4 inline-block text-primary hover:underline">
          Вернуться к регистрации
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-md">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
      >
        ← Назад
      </button>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
            {error}
          </div>
        )}
        {resendSuccess && (
          <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
            Письмо отправлено повторно
          </div>
        )}
        <div>
          <p className="mt-1 text-sm text-muted-foreground">
            Код отправлен на <span className="font-medium text-foreground">{emailParam}</span>
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Код из письма
          </label>
          <input
            {...register("code")}
            type="text"
            inputMode="numeric"
            maxLength={6}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-center text-lg tracking-[0.5em] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="000000"
          />
          {errors.code && (
            <p className="mt-1 text-sm text-danger">{errors.code.message}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full cursor-pointer rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {isSubmitting ? "Проверка..." : "Подтвердить"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Не пришло письмо?{" "}
        <button
          type="button"
          onClick={onResend}
          disabled={resending}
          className="cursor-pointer text-primary hover:underline disabled:opacity-50"
        >
          {resending ? "Отправка..." : "Отправить повторно"}
        </button>
        {" или "}
        <Link href="/register" className="cursor-pointer text-primary hover:underline">
          зарегистрируйтесь снова
        </Link>
      </p>
    </div>
  );
}

export function VerifyEmailForm() {
  return (
    <Suspense fallback={<div className="rounded-xl border border-border bg-surface p-6">Загрузка...</div>}>
      <VerifyEmailFormInner />
    </Suspense>
  );
}
