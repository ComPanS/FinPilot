import Link from "next/link";

const EMAIL = "support@finpilot.ru";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ФинПилот
          </span>
          <nav className="flex flex-wrap items-center justify-center gap-6">
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Политика конфиденциальности
            </Link>
            <Link
              href="/terms"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Правила использования
            </Link>
            <a
              href={`mailto:${EMAIL}`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {EMAIL}
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
