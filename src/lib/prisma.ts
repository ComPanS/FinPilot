import { PrismaClient } from "@prisma/client";
import { encryptionExtension } from "./prisma-encryption";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<PrismaClient["$extends"]>;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  }).$extends(encryptionExtension());

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
