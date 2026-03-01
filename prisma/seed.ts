import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
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

async function main() {
  for (const cat of categories) {
    await prisma.expenseCategory.upsert({
      where: { slug: cat.slug },
      create: { ...cat, isSystem: true },
      update: {},
    });
  }
  console.log("Seeded expense categories");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
