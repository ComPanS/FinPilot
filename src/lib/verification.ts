import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 15;
const EMAIL_CHANGE_EXPIRY_MINUTES = 60;

function generateCode(): string {
  const digits = "0123456789";
  let code = "";
  const bytes = randomBytes(CODE_LENGTH);
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += digits[bytes[i]! % 10];
  }
  return code;
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSignupVerification(email: string): Promise<string> {
  const code = generateCode();
  const expires = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: { identifier: email, token: code, expires },
  });

  return code;
}

export async function verifySignupCode(
  email: string,
  code: string
): Promise<boolean> {
  const record = await prisma.verificationToken.findFirst({
    where: { identifier: email, token: code },
  });
  if (!record || record.expires < new Date()) return false;

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { email },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.deleteMany({
      where: { identifier: email, token: code },
    }),
  ]);
  return true;
}

export async function createEmailChangeRequest(
  userId: string,
  newEmail: string
): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + EMAIL_CHANGE_EXPIRY_MINUTES * 60 * 1000
  );

  await prisma.pendingEmailChange.deleteMany({ where: { userId } });
  await prisma.pendingEmailChange.create({
    data: { userId, newEmail, token, expiresAt },
  });

  return token;
}

export async function verifyEmailChange(token: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const record = await prisma.pendingEmailChange.findUnique({
    where: { token },
  });
  if (!record) return { success: false, error: "Ссылка недействительна" };
  if (record.expiresAt < new Date())
    return { success: false, error: "Ссылка истекла" };

  const existing = await prisma.user.findUnique({
    where: { email: record.newEmail },
  });
  if (existing)
    return { success: false, error: "Этот email уже используется" };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { email: record.newEmail, emailVerified: new Date() },
    }),
    prisma.pendingEmailChange.delete({ where: { token } }),
  ]);

  return { success: true };
}
