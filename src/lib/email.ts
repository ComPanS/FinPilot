import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass) {
    throw new Error("SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendVerificationEmail(email: string, code: string) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transporter = getTransporter();
  await transporter.sendMail({
    from,
    to: email,
    subject: "Подтверждение email — ФинПилот",
    text: `Ваш код подтверждения: ${code}\n\nКод действителен 15 минут.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2>Подтверждение email</h2>
        <p>Ваш код подтверждения:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p style="color: #64748b;">Код действителен 15 минут.</p>
        <p>Если вы не регистрировались в ФинПилот, проигнорируйте это письмо.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transporter = getTransporter();
  await transporter.sendMail({
    from,
    to: email,
    subject: "Восстановление пароля — ФинПилот",
    text: `Восстановите пароль, перейдя по ссылке:\n${resetUrl}\n\nСсылка действительна 1 час.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2>Восстановление пароля</h2>
        <p>Вы запросили восстановление пароля.</p>
        <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px;">Сбросить пароль</a></p>
        <p style="color: #64748b;">Ссылка действительна 1 час.</p>
        <p>Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.</p>
      </div>
    `,
  });
}

export async function sendEmailChangeVerification(
  newEmail: string,
  verifyUrl: string
) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transporter = getTransporter();
  await transporter.sendMail({
    from,
    to: newEmail,
    subject: "Подтверждение смены email — ФинПилот",
    text: `Подтвердите смену email, перейдя по ссылке:\n${verifyUrl}\n\nСсылка действительна 1 час.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2>Подтверждение смены email</h2>
        <p>Вы запросили смену email на ${newEmail}.</p>
        <p><a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px;">Подтвердить</a></p>
        <p style="color: #64748b;">Ссылка действительна 1 час.</p>
      </div>
    `,
  });
}
