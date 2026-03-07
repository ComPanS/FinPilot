"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  createSignupVerification,
  createPasswordResetToken,
  consumePasswordResetToken,
} from "@/lib/verification";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email";
import { authLimiter, forgotPasswordLimiter, resendVerificationLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { registerSchema, verifyEmailSchema, forgotPasswordSchema, resetPasswordSchema } from "@/lib/schemas/auth";

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
}) {
  try {
    const parsed = registerSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Неверные данные" };
    const h = await headers();
    const { success } = await authLimiter.limit(getClientIdentifier(h));
    if (!success) return { error: "Слишком много попыток. Попробуйте позже." };
    const { name, email, password } = parsed.data;
    const existing = await prisma.user.findUnique({
      where: { email },
    });
    const hashedPassword = await bcrypt.hash(password, 10);
    if (existing) {
      if (existing.emailVerified) {
        return { error: "Пользователь с таким email уже существует" };
      }
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          password: hashedPassword,
          consentAt: new Date(),
        },
      });
    } else {
      await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          consentAt: new Date(),
        },
      });
    }

    const code = await createSignupVerification(email);
    await sendVerificationEmail(email, code);
    return { success: true, verifyEmail: email };
  } catch (e) {
    console.error("Register error:", e);
    return { error: "Ошибка регистрации. Попробуйте позже." };
  }
}

export async function verifyEmailAction(email: string, code: string) {
  try {
    const parsed = verifyEmailSchema.safeParse({ email, code });
    if (!parsed.success) return { error: "Неверные данные" };
    const { verifySignupCode } = await import("@/lib/verification");
    const ok = await verifySignupCode(parsed.data.email, parsed.data.code);
    if (!ok) return { error: "Неверный или истёкший код" };
    return { success: true, email: parsed.data.email };
  } catch (e) {
    console.error("Verify error:", e);
    return { error: "Ошибка проверки" };
  }
}

export async function resendVerificationAction(email: string) {
  try {
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) return { error: "Неверный email" };
    const h = await headers();
    const { success } = await resendVerificationLimiter.limit(getClientIdentifier(h));
    if (!success) return { error: "Слишком много попыток. Попробуйте позже." };
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (!user) return { success: true };
    if (user.emailVerified) return { success: true };

    const { createSignupVerification } = await import("@/lib/verification");
    const { sendVerificationEmail } = await import("@/lib/email");
    const code = await createSignupVerification(parsed.data.email);
    await sendVerificationEmail(parsed.data.email, code);
    return { success: true };
  } catch (e) {
    console.error("Resend error:", e);
    return { error: "Ошибка отправки" };
  }
}

export async function forgotPasswordAction(email: string) {
  try {
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) return { error: "Неверный email" };
    const h = await headers();
    const { success } = await forgotPasswordLimiter.limit(getClientIdentifier(h));
    if (!success) return { error: "Слишком много попыток. Попробуйте позже." };
    const token = await createPasswordResetToken(parsed.data.email);
    if (!token) {
      // Don't reveal if user exists - always show success
      return { success: true };
    }

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    await sendPasswordResetEmail(parsed.data.email, resetUrl);
    return { success: true };
  } catch (e) {
    console.error("Forgot password error:", e);
    return { error: "Ошибка отправки. Проверьте SMTP." };
  }
}

export async function resetPasswordAction(token: string, newPassword: string) {
  try {
    const parsed = resetPasswordSchema.safeParse({ token, newPassword });
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Минимум 6 символов" };
    const result = await consumePasswordResetToken(parsed.data.token, parsed.data.newPassword);
    if (!result.success) return { error: result.error };
    return { success: true };
  } catch (e) {
    console.error("Reset password error:", e);
    return { error: "Ошибка сброса пароля" };
  }
}
