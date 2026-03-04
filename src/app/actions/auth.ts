"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  createSignupVerification,
  createPasswordResetToken,
  consumePasswordResetToken,
} from "@/lib/verification";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email";

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
}) {
  try {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    const hashedPassword = await bcrypt.hash(data.password, 10);
    if (existing) {
      if (existing.emailVerified) {
        return { error: "Пользователь с таким email уже существует" };
      }
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          password: hashedPassword,
          consentAt: new Date(),
        },
      });
    } else {
      await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: hashedPassword,
          consentAt: new Date(),
        },
      });
    }

    const code = await createSignupVerification(data.email);
    await sendVerificationEmail(data.email, code);
    return { success: true, verifyEmail: data.email };
  } catch (e) {
    console.error("Register error:", e);
    return { error: "Ошибка регистрации. Попробуйте позже." };
  }
}

export async function verifyEmailAction(email: string, code: string) {
  try {
    const { verifySignupCode } = await import("@/lib/verification");
    const ok = await verifySignupCode(email, code);
    if (!ok) return { error: "Неверный или истёкший код" };
    return { success: true, email };
  } catch (e) {
    console.error("Verify error:", e);
    return { error: "Ошибка проверки" };
  }
}

export async function resendVerificationAction(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) return { error: "Пользователь не найден" };
    if (user.emailVerified) return { error: "Email уже подтверждён" };

    const { createSignupVerification } = await import("@/lib/verification");
    const { sendVerificationEmail } = await import("@/lib/email");
    const code = await createSignupVerification(email);
    await sendVerificationEmail(email, code);
    return { success: true };
  } catch (e) {
    console.error("Resend error:", e);
    return { error: "Ошибка отправки" };
  }
}

export async function forgotPasswordAction(email: string) {
  try {
    const token = await createPasswordResetToken(email);
    if (!token) {
      // Don't reveal if user exists - always show success
      return { success: true };
    }

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetUrl);
    return { success: true };
  } catch (e) {
    console.error("Forgot password error:", e);
    return { error: "Ошибка отправки. Проверьте SMTP." };
  }
}

export async function resetPasswordAction(token: string, newPassword: string) {
  try {
    if (!newPassword || newPassword.length < 6) {
      return { error: "Минимум 6 символов" };
    }
    const result = await consumePasswordResetToken(token, newPassword);
    if (!result.success) return { error: result.error };
    return { success: true };
  } catch (e) {
    console.error("Reset password error:", e);
    return { error: "Ошибка сброса пароля" };
  }
}
