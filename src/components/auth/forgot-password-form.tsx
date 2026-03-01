"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";

const schema = z.object({
  email: z.string().email("Введите корректный email"),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    // TODO: Implement email sending (Resend, SendGrid, etc.)
    await new Promise((r) => setTimeout(r, 1000));
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-md text-center">
        <p className="text-foreground">
          Если аккаунт с таким email существует, вы получите письмо с инструкциями.
        </p>
        <Link href="/login" className="mt-4 inline-block text-primary hover:underline">
          Вернуться к входу
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {isSubmitting ? "Отправка..." : "Отправить"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Вернуться к входу
        </Link>
      </p>
    </div>
  );
}
