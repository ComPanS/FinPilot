/**
 * Seed regular expenses, incomes, ExpectedEntry (5 months) and ActualEntry (daily 01.01.2026-05.03.2026)
 * for profile cmmdvk5dz000jjghgkvlotqbx. Realistic micro-business data.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROFILE_ID = process.env.PROFILE_ID ?? "cmmeqhe390002jgboln9sca2d";
const START_DATE = new Date("2026-01-01");

/** Generate date keys from start to end inclusive */
function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start + "T12:00:00");
  const endD = new Date(end + "T12:00:00");
  while (d <= endD) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Seeded random [0,1) for reproducibility */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/** Seeded random in range [min, max] */
function seededRand(min: number, max: number, seed: number): number {
  return Math.floor(min + seededRandom(seed) * (max - min + 1));
}

async function main() {
  const profile = await prisma.cashFlowProfile.findUnique({
    where: { id: PROFILE_ID },
  });
  if (!profile) {
    throw new Error(`Profile ${PROFILE_ID} not found`);
  }

  // Clean existing data for this profile
  await prisma.actualEntry.deleteMany({ where: { profileId: PROFILE_ID } });
  await prisma.expectedEntry.deleteMany({ where: { profileId: PROFILE_ID } });
  await prisma.regularExpense.deleteMany({ where: { profileId: PROFILE_ID } });
  await prisma.regularIncome.deleteMany({ where: { profileId: PROFILE_ID } });

  const expenseCats = await prisma.expenseCategory.findMany({
    where: { isSystem: true },
  });
  const incomeCats = await prisma.incomeCategory.findMany({
    where: { isSystem: true },
  });

  const getExpenseCat = (slug: string) =>
    expenseCats.find((c) => c.slug === slug) ?? expenseCats.find((c) => c.slug === "other")!;
  const getIncomeCat = (slug: string) =>
    incomeCats.find((c) => c.slug === slug) ?? incomeCats.find((c) => c.slug === "other")!;

  // --- 5 Regular Expenses (micro business) ---
  const expensesData = [
    { name: "Аренда помещения", slug: "rent", amount: 35000 },
    { name: "Зарплата сотрудника", slug: "salary", amount: 45000 },
    { name: "Закупка товара", slug: "purchases", amount: 78000 },
    { name: "Коммунальные услуги", slug: "utilities", amount: 5200 },
    { name: "Маркетинг и реклама", slug: "marketing", amount: 12000 },
  ];

  const createdExpenses: { id: string; name: string; baseAmount: number }[] = [];
  for (const e of expensesData) {
    const cat = getExpenseCat(e.slug);
    const exp = await prisma.regularExpense.create({
      data: {
        profileId: PROFILE_ID,
        categoryId: cat.id,
        name: e.name,
        amount: e.amount,
        frequency: "MONTHLY",
        startDate: START_DATE,
      },
    });
    createdExpenses.push({ id: exp.id, name: exp.name, baseAmount: e.amount });
  }
  console.log("Created 5 regular expenses:", createdExpenses.map((e) => e.name).join(", "));

  // --- 5 Regular Incomes (micro business) ---
  const incomesData = [
    { name: "Продажи товаров", slug: "sales", amount: 145000 },
    { name: "Услуги и консультации", slug: "services", amount: 28000 },
    { name: "Допродажи и аксессуары", slug: "sales", amount: 18000 },
    { name: "Партнёрские выплаты", slug: "other", amount: 7000 },
    { name: "Прочие поступления", slug: "other", amount: 5000 },
  ];

  const createdIncomes: { id: string; name: string; baseAmount: number }[] = [];
  for (const i of incomesData) {
    const cat = getIncomeCat(i.slug);
    const inc = await prisma.regularIncome.create({
      data: {
        profileId: PROFILE_ID,
        name: i.name,
        amount: i.amount,
        frequency: "MONTHLY",
        categoryId: cat.id,
        startDate: START_DATE,
      },
    });
    createdIncomes.push({ id: inc.id, name: inc.name, baseAmount: i.amount });
  }
  console.log("Created 5 regular incomes:", createdIncomes.map((i) => i.name).join(", "));

  // --- ExpectedEntry: 5 months (2026-01 .. 2026-05) for each expense and income ---
  const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
  const janExp = [35200, 45000, 76500, 5100, 13500];
  const febExp = [35000, 45000, 82000, 5300, 11000];
  const marExp = [35000, 45000, 78000, 5200, 12000];
  const aprExp = [35500, 45000, 80000, 5000, 15000];
  const mayExp = [35000, 47000, 85000, 4800, 13000];
  const expByMonth = [janExp, febExp, marExp, aprExp, mayExp];

  const janInc = [138000, 26500, 19500, 6500, 4200];
  const febInc = [152000, 29000, 17000, 7200, 4800];
  const marInc = [148000, 30000, 19000, 7500, 5500];
  const aprInc = [155000, 32000, 20000, 8000, 6000];
  const mayInc = [160000, 35000, 22000, 8500, 6500];
  const incByMonth = [janInc, febInc, marInc, aprInc, mayInc];

  for (let mi = 0; mi < months.length; mi++) {
    const month = months[mi];
    for (let i = 0; i < createdExpenses.length; i++) {
      await prisma.expectedEntry.upsert({
        where: {
          profileId_entityType_entityId_period: {
            profileId: PROFILE_ID,
            entityType: "EXPENSE",
            entityId: createdExpenses[i].id,
            period: month,
          },
        },
        create: {
          profileId: PROFILE_ID,
          entityType: "EXPENSE",
          entityId: createdExpenses[i].id,
          period: month,
          amount: expByMonth[mi][i],
          source: "MANUAL",
        },
        update: { amount: expByMonth[mi][i] },
      });
    }
    for (let i = 0; i < createdIncomes.length; i++) {
      await prisma.expectedEntry.upsert({
        where: {
          profileId_entityType_entityId_period: {
            profileId: PROFILE_ID,
            entityType: "INCOME",
            entityId: createdIncomes[i].id,
            period: month,
          },
        },
        create: {
          profileId: PROFILE_ID,
          entityType: "INCOME",
          entityId: createdIncomes[i].id,
          period: month,
          amount: incByMonth[mi][i],
          source: "MANUAL",
        },
        update: { amount: incByMonth[mi][i] },
      });
    }
  }
  console.log("Created ExpectedEntry for 5 months (2026-01 .. 2026-05)");

  // --- ActualEntry: по дням 01.01.2026 - 05.03.2026 ---
  const allDays = dateRange("2026-01-01", "2026-03-05");

  // Индексы: 0=аренда, 1=зарплата, 2=закупки, 3=коммуналка, 4=маркетинг
  // Расходы: аренда и зарплата — разовые платежи; закупки, коммуналка, маркетинг — распределены
  const expenseIdx = {
    rent: 0,
    salary: 1,
    purchases: 2,
    utilities: 3,
    marketing: 4,
  };

  // Индексы доходов: 0=продажи, 1=услуги, 2=допродажи, 3=партнёры, 4=прочее
  const incomeIdx = { sales: 0, services: 1, accessories: 2, partner: 3, other: 4 };

  // Базовые дневные суммы (для распределения)
  const dailyPurchasesBase = 78000 / 30;
  const dailyMarketingBase = 12000 / 30;

  for (const dateKey of allDays) {
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // --- Расходы по дням ---
    for (let ei = 0; ei < createdExpenses.length; ei++) {
      let amount = 0;

      if (ei === expenseIdx.rent) {
        // Аренда: 1-го числа каждого месяца
        if (d === 1) amount = 35000;
      } else if (ei === expenseIdx.salary) {
        // Зарплата: 28-е (январь, февраль)
        if (d === 28) amount = 45000;
      } else if (ei === expenseIdx.purchases) {
        // Закупки: ежедневно, с вариацией. Выходные меньше
        const mult = isWeekend ? 0.4 : 1;
        const varFactor = 0.7 + seededRandom(y * 10000 + m * 100 + d) * 0.6;
        amount = Math.round(dailyPurchasesBase * mult * varFactor);
      } else if (ei === expenseIdx.utilities) {
        // Коммуналка: 15-го числа (янв, фев); 5 марта — пропорция за 5 дней
        if (d === 15) amount = 5200;
        if (m === 3 && d === 5) amount = Math.round(5200 * (5 / 31));
      } else if (ei === expenseIdx.marketing) {
        // Маркетинг: несколько дней в месяц + мелкие ежедневные
        const seed = y * 1000 + m * 50 + d + ei;
        const r = seededRandom(seed);
        if (r < 0.15) amount = seededRand(800, 1500, seed + 1);
        else if (d % 7 === 1) amount = seededRand(400, 800, seed + 2);
        else amount = Math.round(dailyMarketingBase * (0.5 + r * 0.5));
      }

      if (amount > 0) {
        await prisma.actualEntry.create({
          data: {
            profileId: PROFILE_ID,
            entityType: "EXPENSE",
            entityId: createdExpenses[ei].id,
            period: dateKey,
            amount,
          },
        });
      }
    }

    // --- Доходы по дням ---
    for (let ii = 0; ii < createdIncomes.length; ii++) {
      let amount = 0;
      const r = seededRandom(y * 2000 + m * 100 + d + ii * 17);

      if (ii === incomeIdx.sales) {
        // Продажи: ежедневно, выходные выше
        const base = isWeekend ? 5500 : 4200;
        amount = Math.round(base * (0.85 + r * 0.3));
      } else if (ii === incomeIdx.services) {
        // Услуги: не каждый день
        if (r > 0.4) amount = seededRand(600, 1400, y * 2000 + m * 100 + d + ii * 17 + 100);
      } else if (ii === incomeIdx.accessories) {
        // Допродажи: чаще в выходные
        const base = isWeekend ? 700 : 500;
        amount = Math.round(base * (0.8 + r * 0.4));
      } else if (ii === incomeIdx.partner) {
        // Партнёры: 2-3 раза в неделю
        if (r > 0.7) amount = seededRand(200, 400, y * 2000 + m * 100 + d + ii * 17 + 200);
      } else if (ii === incomeIdx.other) {
        // Прочее: мелкие поступления
        if (r > 0.6) amount = seededRand(80, 250, y * 2000 + m * 100 + d + ii * 17 + 300);
      }

      if (amount > 0) {
        await prisma.actualEntry.create({
          data: {
            profileId: PROFILE_ID,
            entityType: "INCOME",
            entityId: createdIncomes[ii].id,
            period: dateKey,
            amount,
          },
        });
      }
    }
  }

  console.log(`Created ActualEntry for ${allDays.length} days (01.01.2026 - 05.03.2026)`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
