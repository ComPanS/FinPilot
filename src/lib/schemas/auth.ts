import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1, "Введите имя").max(200),
  email: z.string().email("Введите корректный email").max(255),
  password: z.string().min(8, "Минимум 8 символов").max(128),
});

export const verifyEmailSchema = z.object({
  email: z.string().email().max(255),
  code: z.string().min(4).max(10),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, "Минимум 8 символов").max(128),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Минимум 8 символов").max(128),
});
