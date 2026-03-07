import Link from "next/link";
import { LegalHeader } from "@/components/layout/legal-header";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <LegalHeader />
      <main className="mx-auto flex max-w-3xl flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-8xl font-bold text-primary/20">404</p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">
          Страница не найдена
        </h1>
        <p className="mt-2 text-muted-foreground">
          Запрашиваемая страница не существует или была перемещена.
        </p>
        <Link
          href="/"
          className="mt-8 rounded-lg bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-dark"
        >
          На главную
        </Link>
      </main>
    </div>
  );
}
