"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "./site-footer";

/** Показывает SiteFooter везде, кроме лендинга (/) — там свой футер */
export function ConditionalFooter() {
  const pathname = usePathname();

  if (pathname === "/") return null;

  return <SiteFooter />;
}
