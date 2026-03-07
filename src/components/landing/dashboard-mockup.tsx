"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles } from "lucide-react";

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return d && m ? `${d}.${m}` : dateStr;
}

type ChartPoint = {
  date: string;
  dateShort: string;
  balance: number;
  balanceFact: number | null;
  balanceExpected: number;
  positiveBalance: number;
  negativeBalance: number;
  isFact: boolean;
};

function generateChartData(): ChartPoint[] {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endDate = new Date(firstDay);
  endDate.setDate(endDate.getDate() + 90);

  const data: ChartPoint[] = [];
  const current = new Date(firstDay);

  // Example trajectory: start ~400k, drop to -50k around day 40, recover to ~250k
  const trajectory = [
    400000, 380000, 350000, 320000, 280000, 240000, 200000, 150000, 100000,
    50000, 10000, -20000, -50000, -55000, -40000, -10000, 30000, 80000, 150000, 220000, 280000,
  ];
  const trajectoryLen = trajectory.length;

  let dayIndex = 0;
  while (current <= endDate) {
    const dateStr = current.toISOString().slice(0, 10);
    const isFact = current <= today;
    const progress = Math.min((dayIndex / 85) * (trajectoryLen - 1), trajectoryLen - 1);
    const idx = Math.floor(progress);
    const frac = progress - idx;
    const balance = idx < trajectoryLen - 1
      ? Math.round(trajectory[idx] + frac * (trajectory[idx + 1] - trajectory[idx]))
      : trajectory[trajectoryLen - 1];

    data.push({
      date: dateStr,
      dateShort: formatDateShort(dateStr),
      balance,
      balanceFact: isFact ? balance : null,
      balanceExpected: balance,
      positiveBalance: balance >= 0 ? balance : 0,
      negativeBalance: balance < 0 ? balance : 0,
      isFact,
    });

    current.setDate(current.getDate() + 1);
    dayIndex++;
  }

  return data;
}

export function DashboardMockup() {
  const chartData = useMemo(() => generateChartData(), []);

  return (
    <div className="bg-surface rounded-xl shadow-2xl p-6 border border-border">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-1">Прогноз денежных потоков</h3>
        <p className="text-sm text-muted-foreground">Факт до сегодня, далее — ожидаемые данные</p>
      </div>

      {/* Chart */}
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="dateShort"
              stroke="var(--muted)"
              style={{ fontSize: "12px" }}
            />
            <YAxis
              stroke="var(--muted)"
              style={{ fontSize: "12px" }}
              tickFormatter={(value) => `${value / 1000}k`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]?.payload as ChartPoint;
                const balanceFact = p?.balanceFact;
                const balanceExp = p?.balanceExpected ?? 0;
                const val = balanceFact != null ? balanceFact : balanceExp;
                const label = balanceFact != null ? "Баланс" : "Ожидаемый баланс";
                return (
                  <div
                    style={{
                      backgroundColor: "var(--surface)",
                      color: "var(--foreground)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "12px",
                    }}
                  >
                    <p className="font-medium">Дата: {p?.dateShort}</p>
                    <p
                      style={{
                        color: val >= 0 ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {label}: {(val ?? 0).toLocaleString("ru-RU")} ₽
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="3 3" />
            <Area
              type="monotoneX"
              dataKey="positiveBalance"
              stroke="none"
              fill="var(--success)"
              fillOpacity={0.15}
              baseValue={0}
            />
            <Area
              type="monotoneX"
              dataKey="negativeBalance"
              stroke="none"
              fill="var(--danger)"
              fillOpacity={0.15}
              baseValue={0}
            />
            <Line
              type="monotoneX"
              dataKey="balanceExpected"
              name="Ожидаемый"
              stroke="var(--muted)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
            />
            <Line
              type="monotoneX"
              dataKey="balanceFact"
              name="Факт"
              stroke="var(--success)"
              strokeWidth={2}
              dot={{ r: 4, fill: "var(--success)", stroke: "var(--surface)", strokeWidth: 2 }}
              connectNulls={false}
              activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Balance Zones */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-success/10 rounded-lg p-3 border border-success/30">
          <div className="text-xs text-success mb-1">Безопасная зона</div>
          <div className="text-lg font-semibold text-success">620k ₽</div>
        </div>
        <div className="bg-warning/10 rounded-lg p-3 border border-warning/30">
          <div className="text-xs text-warning mb-1">Внимание</div>
          <div className="text-lg font-semibold text-warning">480k ₽</div>
        </div>
        <div className="bg-danger/10 rounded-lg p-3 border border-danger/30">
          <div className="text-xs text-danger mb-1">Риск разрыва</div>
          <div className="text-lg font-semibold text-danger">-50k ₽</div>
        </div>
      </div>

      {/* AI Recommendation Card */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-foreground mb-1 text-sm">Рекомендация ИИ</h4>
            <p className="text-sm text-muted-foreground">
              На 45-й день прогнозируется кассовый разрыв. Рекомендую договориться с поставщиком об отсрочке платежа или ускорить взыскание дебиторской задолженности.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
