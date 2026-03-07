import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sparkles } from "lucide-react";

const cashFlowData = [
  { day: "1", balance: 450000 },
  { day: "10", balance: 520000 },
  { day: "20", balance: 480000 },
  { day: "30", balance: 580000 },
  { day: "40", balance: 540000 },
  { day: "50", balance: 620000 },
  { day: "60", balance: 590000 },
  { day: "70", balance: 680000 },
  { day: "80", balance: 720000 },
  { day: "90", balance: 780000 },
];

export function DashboardMockup() {
  return (
    <div className="bg-white rounded-xl shadow-2xl p-6 border border-[#E2E8F0]">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[#0F172A] mb-1">Прогноз денежных потоков</h3>
        <p className="text-sm text-gray-500">Следующие 90 дней</p>
      </div>

      {/* Chart */}
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={cashFlowData}>
            <defs>
              <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis 
              dataKey="day" 
              stroke="#94A3B8"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#94A3B8"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `${value / 1000}k`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              formatter={(value: number | undefined) => [`${(value ?? 0).toLocaleString('ru-RU')} ₽`, 'Баланс']}
              labelFormatter={(label) => `День ${label}`}
            />
            <Area 
              type="monotone" 
              dataKey="balance" 
              stroke="#10B981" 
              strokeWidth={2}
              fill="url(#colorBalance)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Balance Zones */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[#DCFCE7] rounded-lg p-3 border border-[#BBF7D0]">
          <div className="text-xs text-[#166534] mb-1">Безопасная зона</div>
          <div className="text-lg font-semibold text-[#166534]">620k ₽</div>
        </div>
        <div className="bg-[#FEF3C7] rounded-lg p-3 border border-[#FDE68A]">
          <div className="text-xs text-[#92400E] mb-1">Внимание</div>
          <div className="text-lg font-semibold text-[#92400E]">480k ₽</div>
        </div>
        <div className="bg-[#FEE2E2] rounded-lg p-3 border border-[#FECACA]">
          <div className="text-xs text-[#991B1B] mb-1">Риск разрыва</div>
          <div className="text-lg font-semibold text-[#991B1B]">450k ₽</div>
        </div>
      </div>

      {/* AI Recommendation Card */}
      <div className="bg-gradient-to-br from-[#10B981]/10 to-[#10B981]/5 rounded-lg p-4 border border-[#10B981]/20">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#10B981] flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-[#0F172A] mb-1 text-sm">Рекомендация ИИ</h4>
            <p className="text-sm text-[#475569]">
              На 45-й день прогнозируется кассовый разрыв. Рекомендую договориться с поставщиком об отсрочке платежа или ускорить взыскание дебиторской задолженности.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
