import { PrismaClient } from "@prisma/client";
import { encryptionExtension } from "./prisma-encryption";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<PrismaClient["$extends"]>;
};

const extended =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  }).$extends(encryptionExtension());

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = extended;

/** Extended Prisma client with encryption. Typed as PrismaClient for proper model inference. */
export const prisma = extended as unknown as PrismaClient;
