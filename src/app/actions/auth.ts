"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
}) {
  try {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      return { error: "Пользователь с таким email уже существует" };
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        consentAt: new Date(),
      },
    });
    return { success: true };
  } catch (e) {
    console.error("Register error:", e);
    return { error: "Ошибка регистрации. Попробуйте позже." };
  }
}
