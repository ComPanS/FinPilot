"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateProfileAction, updatePasswordAction, updateZoneSettingsAction, deleteAccountAction, requestEmailChangeAction } from "@/app/actions/settings";

const profileSchema = z.object({
  name: z.string().min(1),
  weeklyReport: z.boolean(),
});

const zoneSchema = z.object({
  zoneGreenMin: z.coerce.number(),
  zoneRedMax: z.coerce.number(),
}).refine((d) => d.zoneGreenMin > d.zoneRedMax, {
  message: "Зелёный порог должен быть выше красного",
  path: ["zoneGreenMin"],
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
});

const emailSchema = z.object({
  newEmail: z.string().email("Введите корректный email"),
});

type ProfileData = z.infer<typeof profileSchema>;
type PasswordData = z.infer<typeof passwordSchema>;
type ZoneData = z.infer<typeof zoneSchema>;
type EmailData = z.infer<typeof emailSchema>;

type User = { id: string; name: string | null; email: string; weeklyReport: boolean };
type Profile = { id: string; zoneGreenMin: number | null; zoneRedMax: number | null } | null;

export function SettingsForm({ user, profile }: { user: User; profile?: Profile }) {
  const [message, setMessage] = useState<string | null>(null);

  const emailForm = useForm<EmailData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: "" },
  });

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

  const zoneForm = useForm<ZoneData>({
    resolver: zodResolver(zoneSchema),
    defaultValues: {
      zoneGreenMin: profile?.zoneGreenMin ?? 50000,
      zoneRedMax: profile?.zoneRedMax ?? -50000,
    },
  });

  const onProfileSubmit = profileForm.handleSubmit(async (data) => {
    const res = await updateProfileAction(data);
    setMessage(res?.error ?? "Профиль обновлён");
  });

  const onEmailSubmit = emailForm.handleSubmit(async (data) => {
    const res = await requestEmailChangeAction(data.newEmail);
    setMessage(res?.error ?? "Письмо отправлено на новый email");
    if (res?.success) emailForm.reset();
  });

  const onZoneSubmit = zoneForm.handleSubmit(async (data) => {
    if (!profile) return;
    const res = await updateZoneSettingsAction(profile.id, data);
    setMessage(res?.error ?? "Диапазон зон сохранён");
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
        <h3 className="font-semibold">Смена email</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Текущий email: {user.email}
        </p>
        <form onSubmit={onEmailSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">Новый email</label>
            <input
              {...emailForm.register("newEmail")}
              type="email"
              className="mt-1 w-full max-w-md rounded border border-border px-3 py-2"
              placeholder="new@example.com"
            />
            {emailForm.formState.errors.newEmail && (
              <p className="mt-1 text-sm text-danger">
                {emailForm.formState.errors.newEmail.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark"
          >
            Отправить ссылку подтверждения
          </button>
        </form>
      </div>

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

      {profile && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="font-semibold">Диапазон зон на графике</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Пороги для зелёной зоны (≥) и красной зоны (&lt;)
          </p>
          <form onSubmit={onZoneSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium">Зелёная зона от (₽)</label>
              <input
                {...zoneForm.register("zoneGreenMin")}
                type="number"
                className="mt-1 w-full max-w-md rounded border border-border px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Красная зона до (₽)</label>
              <input
                {...zoneForm.register("zoneRedMax")}
                type="number"
                className="mt-1 w-full max-w-md rounded border border-border px-3 py-2"
              />
            </div>
            <button
              type="submit"
              className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark"
            >
              Сохранить
            </button>
          </form>
        </div>
      )}

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
