import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)",
    );
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
    subject: "Подтверждение email — ФинПланер",
    text: `Ваш код подтверждения: ${code}\n\nКод действителен 15 минут.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; background: #f8fafc;">
        <div style="max-width: 480px; margin: 0 auto; padding: 40px 24px;">
          <div style="background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background: #10b981; padding: 24px; text-align: center;">
              <span style="font-size: 24px; font-weight: 700; color: #ffffff;">ФинПланер</span>
            </div>
            <div style="padding: 32px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; color: #0f172a;">Подтверждение email</h2>
              <p style="margin: 0 0 16px; font-size: 15px; color: #475569; line-height: 1.5;">Введите этот код в приложении для завершения регистрации:</p>
              <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
                <span style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #0f172a;">${code}</span>
              </div>
              <p style="margin: 0; font-size: 13px; color: #64748b;">Код действителен 15 минут.</p>
              <p style="margin: 24px 0 0; font-size: 13px; color: #94a3b8;">Если вы не регистрировались в ФинПланер, проигнорируйте это письмо.</p>
            </div>
          </div>
          <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8; text-align: center;">© ${new Date().getFullYear()} ФинПланер</p>
        </div>
      </body>
      </html>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transporter = getTransporter();
  await transporter.sendMail({
    from,
    to: email,
    subject: "Восстановление пароля — ФинПланер",
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
  verifyUrl: string,
) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transporter = getTransporter();
  await transporter.sendMail({
    from,
    to: newEmail,
    subject: "Подтверждение смены email — ФинПланер",
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
