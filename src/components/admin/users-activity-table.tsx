"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { UserActivityRow } from "@/app/admin/actions";

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString("ru-RU");
}

type SortKey = keyof Pick<
  UserActivityRow,
  "email" | "createdAt" | "lastActionAt" | "regularExpenses" | "regularIncomes" | "actualEntries" | "expectedEntries"
>;
type SortOrder = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "email", label: "Email", align: "left" },
  { key: "createdAt", label: "Регистрация", align: "left" },
  { key: "lastActionAt", label: "Последнее действие", align: "left" },
  { key: "regularExpenses", label: "Кол-во расходов", align: "right" },
  { key: "regularIncomes", label: "Кол-во доходов", align: "right" },
  { key: "actualEntries", label: "Кол-во факт", align: "right" },
  { key: "expectedEntries", label: "Кол-во ожидаемых", align: "right" },
];

export function UsersActivityTable({ data }: { data: UserActivityRow[] }) {
  const [sortBy, setSortBy] = useState<SortKey>("lastActionAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (sortBy === "lastActionAt") {
        const aDate = aVal ? new Date(aVal).getTime() : 0;
        const bDate = bVal ? new Date(bVal).getTime() : 0;
        return sortOrder === "desc" ? bDate - aDate : aDate - bDate;
      }

      if (sortBy === "createdAt") {
        const aDate = new Date(aVal as Date).getTime();
        const bDate = new Date(bVal as Date).getTime();
        return sortOrder === "desc" ? bDate - aDate : aDate - bDate;
      }

      if (sortBy === "email") {
        const aStr = String(aVal ?? "").toLowerCase();
        const bStr = String(bVal ?? "").toLowerCase();
        const cmp = aStr.localeCompare(bStr);
        return sortOrder === "desc" ? -cmp : cmp;
      }

      const aNum = Number(aVal ?? 0);
      const bNum = Number(bVal ?? 0);
      return sortOrder === "desc" ? bNum - aNum : aNum - bNum;
    });
  }, [data, sortBy, sortOrder]);

  function handleSort(key: SortKey) {
    if (sortBy === key) {
      setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortOrder(key === "lastActionAt" ? "desc" : "asc");
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {COLUMNS.map(({ key, label, align }) => (
                <th
                  key={key}
                  className={`px-4 py-3 font-medium text-foreground cursor-pointer select-none hover:bg-muted/50 transition-colors ${
                    align === "right" ? "text-right" : "text-left"
                  }`}
                  onClick={() => handleSort(key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {sortBy === key ? (
                      sortOrder === "desc" ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronUp className="h-4 w-4 shrink-0" />
                      )
                    ) : (
                      <span className="h-4 w-4 shrink-0 opacity-30">
                        <ChevronDown className="h-4 w-4" />
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Нет данных
                </td>
              </tr>
            ) : (
              sortedData.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-3 text-foreground">{row.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.lastActionAt
                      ? formatDate(row.lastActionAt)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(row.regularExpenses)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(row.regularIncomes)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(row.actualEntries)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(row.expectedEntries)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
