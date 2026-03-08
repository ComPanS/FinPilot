"use client";

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

export function UsersActivityTable({ data }: { data: UserActivityRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-foreground">
                Email
              </th>
              <th className="px-4 py-3 text-left font-medium text-foreground">
                Регистрация
              </th>
              <th className="px-4 py-3 text-right font-medium text-foreground">
                Кол-во расходов
              </th>
              <th className="px-4 py-3 text-right font-medium text-foreground">
                Кол-во доходов
              </th>
              <th className="px-4 py-3 text-right font-medium text-foreground">
                Кол-во факт
              </th>
              <th className="px-4 py-3 text-right font-medium text-foreground">
                Кол-во ожидаемых
              </th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Нет данных
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-3 text-foreground">{row.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(row.createdAt)}
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
