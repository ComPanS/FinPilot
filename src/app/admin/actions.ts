"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function getAllowedEmails(): string[] {
  const raw = process.env.ADMIN_ALLOWED_EMAILS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdminAllowed(): Promise<boolean> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return false;
  return getAllowedEmails().includes(email);
}

export async function getRegistrationsByDay(days: number = 30): Promise<
  { date: string; count: number }[]
> {
  if (!(await isAdminAllowed())) return [];
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const result = await prisma.$queryRaw<
    { date: Date; count: bigint }[]
  >`
    SELECT DATE("createdAt")::date as date, COUNT(*)::bigint as count
    FROM "User"
    WHERE "createdAt" >= ${since}
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `;

  const dataMap = new Map<string, number>();
  for (const r of result) {
    const dateStr =
      r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
    dataMap.set(dateStr, Number(r.count));
  }

  // Fill all days in range with 0 where no data
  const filled: { date: string; count: number }[] = [];
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  for (const d = new Date(since); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    filled.push({
      date: dateStr,
      count: dataMap.get(dateStr) ?? 0,
    });
  }
  return filled;
}

export type UserActivityRow = {
  id: string;
  email: string;
  createdAt: Date;
  regularExpenses: number;
  regularIncomes: number;
  actualEntries: number;
  expectedEntries: number;
};

export async function getUsersActivity(): Promise<UserActivityRow[]> {
  if (!(await isAdminAllowed())) return [];

  const users = await prisma.user.findMany({
    include: {
      profiles: {
        include: {
          _count: {
            select: {
              regularExpenses: true,
              regularIncomes: true,
              actualEntries: true,
              expectedEntries: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return users.map((u) => {
    let regularExpenses = 0;
    let regularIncomes = 0;
    let actualEntries = 0;
    let expectedEntries = 0;
    for (const p of u.profiles) {
      regularExpenses += p._count.regularExpenses;
      regularIncomes += p._count.regularIncomes;
      actualEntries += p._count.actualEntries;
      expectedEntries += p._count.expectedEntries;
    }
    return {
      id: u.id,
      email: u.email,
      createdAt: u.createdAt,
      regularExpenses,
      regularIncomes,
      actualEntries,
      expectedEntries,
    };
  });
}
