"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "./site-footer";

/** Показывает SiteFooter везде, кроме лендинга (/) и онбординга — там свой футер / скрыт */
export function ConditionalFooter() {
  const pathname = usePathname();

  if (pathname === "/" || pathname === "/onboarding") return null;

  return <SiteFooter />;
}
