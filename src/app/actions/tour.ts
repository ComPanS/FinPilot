"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getTourCompleted(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.email) return true; // не показываем тур неавторизованным

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { tourCompleted: true },
  });
  return user?.tourCompleted ?? false;
}

export async function setTourCompleted(): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) return;

  await prisma.user.update({
    where: { email: session.user.email },
    data: { tourCompleted: true },
  });
  revalidatePath("/dashboard");
  revalidatePath("/cashflow");
  revalidatePath("/fact");
  revalidatePath("/what-if");
  revalidatePath("/insights");
  revalidatePath("/reports");
}
