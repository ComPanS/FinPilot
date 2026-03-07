"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { createEmailChangeRequest } from "@/lib/verification";
import { sendEmailChangeVerification } from "@/lib/email";
import { updatePasswordSchema } from "@/lib/schemas/auth";

export async function updateProfileAction(data: {
  name: string;
  weeklyReport: boolean;
}) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  await prisma.user.update({
    where: { email: session.user.email },
    data: {
      name: data.name,
      weeklyReport: data.weeklyReport,
    },
  });
  revalidatePath("/settings");
  return { success: true };
}

export async function updatePasswordAction(data: {
  currentPassword: string;
  newPassword: string;
}) {
  const parsed = updatePasswordSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Неверные данные" };
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user?.password) {
    return { error: "Смена пароля только для входа по email" };
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!valid) return { error: "Неверный текущий пароль" };

  const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });
  revalidatePath("/settings");
  return { success: true };
}

export async function updateZoneSettingsAction(
  profileId: string,
  data: { zoneGreenMin: number; zoneRedMax: number }
) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  if (!user || !user.profiles.some((p) => p.id === profileId)) {
    return { error: "Профиль не найден" };
  }

  if (data.zoneGreenMin <= data.zoneRedMax) {
    return { error: "Зелёный порог должен быть выше красного" };
  }

  await prisma.cashFlowProfile.update({
    where: { id: profileId },
    data: {
      zoneGreenMin: data.zoneGreenMin,
      zoneRedMax: data.zoneRedMax,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/cashflow");
  return { success: true };
}

export async function requestEmailChangeAction(newEmail: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) return { error: "Пользователь не найден" };

  const normalized = newEmail.trim().toLowerCase();
  if (normalized === session.user.email.toLowerCase()) {
    return { error: "Новый email совпадает с текущим" };
  }

  const existing = await prisma.user.findUnique({
    where: { email: normalized },
  });
  if (existing) return { error: "Этот email уже используется" };

  try {
    const token = await createEmailChangeRequest(user.id, normalized);
    const baseUrl = process.env.NEXTAUTH_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify-new-email?token=${token}`;
    await sendEmailChangeVerification(normalized, verifyUrl);
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    console.error("Email change request error:", e);
    return { error: "Ошибка отправки письма. Проверьте SMTP." };
  }
}

export async function deleteAccountAction() {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) return { error: "Пользователь не найден" };

  await prisma.user.delete({
    where: { id: user.id },
  });
  return { success: true };
}
