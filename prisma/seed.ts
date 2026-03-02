import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const expenseCategories = [
  { slug: "rent", name: "Аренда" },
  { slug: "salary", name: "Зарплата" },
  { slug: "taxes", name: "Налоги" },
  { slug: "purchases", name: "Закупки" },
  { slug: "subscriptions", name: "Подписки" },
  { slug: "utilities", name: "Коммунальные услуги" },
  { slug: "marketing", name: "Маркетинг и реклама" },
  { slug: "insurance", name: "Страхование" },
  { slug: "equipment", name: "Оборудование" },
  { slug: "transport", name: "Транспорт" },
  { slug: "other", name: "Прочее" },
  { slug: "custom", name: "Своя категория" },
];

const incomeCategories = [
  { slug: "sales", name: "Продажи" },
  { slug: "services", name: "Услуги" },
  { slug: "salary", name: "Зарплата" },
  { slug: "investments", name: "Инвестиции" },
  { slug: "rent", name: "Аренда" },
  { slug: "other", name: "Прочее" },
  { slug: "custom", name: "Своя категория" },
];

async function main() {
  for (const cat of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { slug: cat.slug },
      create: { ...cat, isSystem: true },
      update: {},
    });
  }
  console.log("Seeded expense categories");

  for (const cat of incomeCategories) {
    await prisma.incomeCategory.upsert({
      where: { slug: cat.slug },
      create: { ...cat, isSystem: true },
      update: {},
    });
  }
  console.log("Seeded income categories");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
