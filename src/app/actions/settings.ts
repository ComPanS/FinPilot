"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

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
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user?.password) {
    return { error: "Смена пароля только для входа по email" };
  }

  const valid = await bcrypt.compare(data.currentPassword, user.password);
  if (!valid) return { error: "Неверный текущий пароль" };

  const hashed = await bcrypt.hash(data.newPassword, 10);
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
