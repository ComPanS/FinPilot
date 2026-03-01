"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { registerUser } from "@/app/actions/auth";

const schema = z
  .object({
    name: z.string().min(2, "Минимум 2 символа"),
    email: z.string().email("Введите корректный email"),
    password: z.string().min(6, "Минимум 6 символов"),
    confirmPassword: z.string(),
    consent: z.literal(true, {
      errorMap: () => ({ message: "Необходимо согласие на обработку данных" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const pending = typeof window !== "undefined" ? sessionStorage.getItem("pending_register") : null;
    if (pending) {
      try {
        const parsed = JSON.parse(pending) as { name?: string; email?: string; password?: string };
        if (parsed.name || parsed.email || parsed.password) {
          reset({
            name: parsed.name ?? "",
            email: parsed.email ?? "",
            password: parsed.password ?? "",
            confirmPassword: parsed.password ?? "",
            consent: true,
          });
        }
      } catch {}
    }
  }, [reset]);

  async function onSubmit(data: FormData) {
    setError(null);
    const result = await registerUser({
      name: data.name,
      email: data.email,
      password: data.password,
    });
    if (result?.error) {
      setError(result.error);
      return;
    }
    if (result.verifyEmail) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          "pending_register",
          JSON.stringify({ name: data.name, email: data.email, password: data.password })
        );
      }
      router.push(`/verify-email?email=${encodeURIComponent(result.verifyEmail)}`);
      return;
    }
    const signInResult = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
    if (signInResult?.error) {
      setError("Регистрация прошла, но вход не удался. Попробуйте войти.");
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Имя
          </label>
          <input
            {...register("name")}
            type="text"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Иван Иванов"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-danger">{errors.name.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            {...register("email")}
            type="email"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="you@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-danger">{errors.email.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Пароль
          </label>
          <input
            {...register("password")}
            type="password"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-danger">{errors.password.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Подтвердите пароль
          </label>
          <input
            {...register("confirmPassword")}
            type="password"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="••••••••"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-danger">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
        <div className="flex items-start gap-2">
          <input
            {...register("consent")}
            type="checkbox"
            id="consent"
            className="mt-1 rounded border-border"
          />
          <label htmlFor="consent" className="text-sm text-muted-foreground">
            Даю согласие на обработку персональных данных в соответствии с 152-ФЗ
            и GDPR
          </label>
        </div>
        {errors.consent && (
          <p className="text-sm text-danger">{errors.consent.message}</p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full cursor-pointer rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {isSubmitting ? "Регистрация..." : "Зарегистрироваться"}
        </button>
      </form>
      <div className="mt-4 flex justify-center">
        <a
          href="/api/auth/signin/google"
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface"
        >
          Зарегистрироваться через Google
        </a>
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
