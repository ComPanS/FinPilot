"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateProfileAction, updatePasswordAction, deleteAccountAction } from "@/app/actions/settings";

const profileSchema = z.object({
  name: z.string().min(1),
  weeklyReport: z.boolean(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
});

type ProfileData = z.infer<typeof profileSchema>;
type PasswordData = z.infer<typeof passwordSchema>;

type User = { id: string; name: string | null; email: string; weeklyReport: boolean };

export function SettingsForm({ user }: { user: User }) {
  const [message, setMessage] = useState<string | null>(null);

  const profileForm = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name ?? "",
      weeklyReport: user.weeklyReport ?? false,
    },
  });

  const passwordForm = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
  });

  const onProfileSubmit = profileForm.handleSubmit(async (data) => {
    const res = await updateProfileAction(data);
    setMessage(res?.error ?? "Профиль обновлён");
  });

  const onPasswordSubmit = passwordForm.handleSubmit(async (data) => {
    const res = await updatePasswordAction({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
    setMessage(res?.error ?? "Пароль изменён");
    if (res?.success) passwordForm.reset();
  });

  const onDelete = async () => {
    if (!confirm("Удалить все данные? Это действие необратимо.")) return;
    const res = await deleteAccountAction();
    if (res?.error) {
      setMessage(res.error);
      return;
    }
    window.location.href = "/";
  };

  return (
    <div className="space-y-8">
      {message && (
        <div className="rounded-lg bg-primary/10 p-3 text-sm text-foreground">
          {message}
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="font-semibold">Профиль</h3>
        <form onSubmit={onProfileSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">Имя</label>
            <input
              {...profileForm.register("name")}
              className="mt-1 w-full max-w-md rounded border border-border px-3 py-2"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              {...profileForm.register("weeklyReport")}
              type="checkbox"
              id="weeklyReport"
              className="rounded"
            />
            <label htmlFor="weeklyReport">Еженедельная рассылка прогноза</label>
          </div>
          <button
            type="submit"
            className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark"
          >
            Сохранить
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="font-semibold">Смена пароля</h3>
        <div className="mt-2 text-sm text-muted-foreground">
          Доступно только для входа по email
        </div>
        <form onSubmit={onPasswordSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">Текущий пароль</label>
            <input
              {...passwordForm.register("currentPassword")}
              type="password"
              className="mt-1 w-full max-w-md rounded border border-border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Новый пароль</label>
            <input
              {...passwordForm.register("newPassword")}
              type="password"
              className="mt-1 w-full max-w-md rounded border border-border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Подтвердите</label>
            <input
              {...passwordForm.register("confirmPassword")}
              type="password"
              className="mt-1 w-full max-w-md rounded border border-border px-3 py-2"
            />
            {passwordForm.formState.errors.confirmPassword && (
              <p className="mt-1 text-sm text-danger">
                {passwordForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark"
          >
            Сменить пароль
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-danger/30 bg-danger/5 p-6">
        <h3 className="font-semibold text-danger">Удаление данных</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Удаление всех данных в соответствии с GDPR
        </p>
        <button
          onClick={onDelete}
          className="mt-4 rounded bg-danger px-4 py-2 text-white hover:bg-danger/90"
        >
          Удалить аккаунт
        </button>
      </div>
    </div>
  );
}
