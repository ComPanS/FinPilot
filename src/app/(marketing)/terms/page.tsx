import Link from "next/link";
import { LegalHeader } from "@/components/layout/legal-header";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <LegalHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold text-foreground">
          Правила использования
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Последнее обновление: 07.03.2026
        </p>
        <div className="mt-8 space-y-6 text-foreground">
          <section>
            <h2 className="text-lg font-semibold">1. Общие положения</h2>
            <p className="mt-2 text-muted-foreground">
              Настоящие Правила использования (далее — «Правила») регулируют отношения между ФинПилот (далее — «Владелец Сервиса») и Пользователями Сервиса ФинПилот (далее — «Сервис») в соответствии с Гражданским кодексом РФ, Федеральным законом от 27.07.2006 № 149-ФЗ «Об информации, информационных технологиях и о защите информации», иными нормами РФ. Сервис предоставляется на условиях SaaS и предназначен для планирования денежных потоков ИП и микробизнеса с использованием математических операций для прогнозирования.
            </p>
            <p className="mt-2 text-muted-foreground">
              Регистрация или использование Сервиса означает полное и безоговорочное согласие с Правилами и Политикой конфиденциальности. В случае несогласия Пользователь обязан прекратить использование.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">2. Регистрация и доступ</h2>
            <p className="mt-2 text-muted-foreground">
              Пользователь подтверждает достоверность предоставляемых данных. Владелец Сервиса вправе отказать в регистрации или заблокировать аккаунт при нарушении Правил. Доступ предоставляется на основе тарифных планов, условия которых указаны на сайте и могут изменяться.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">3. Права и обязанности Пользователя</h2>
            <p className="mt-2 text-muted-foreground">
              Пользователь вправе:
            </p>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              <li>Использовать Сервис для законных целей.</li>
              <li>Получать прогнозы, отчеты и рекомендации.</li>
              <li>Управлять данными в аккаунте.</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              Пользователь обязан:
            </p>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              <li>Не использовать Сервис для незаконной деятельности, включая отмывание денег или уклонение от налогов.</li>
              <li>Не передавать доступ третьим лицам.</li>
              <li>Не копировать, модифицировать или распространять контент Сервиса без разрешения.</li>
              <li>Уведомлять о ошибках или нарушениях безопасности.</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              Прогнозы носят информационный характер, основаны на математических операциях и не являются финансовой, юридической или инвестиционной консультацией. Пользователь несет ответственность за свои решения.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">4. Права и обязанности Владельца Сервиса</h2>
            <p className="mt-2 text-muted-foreground">
              Владелец Сервиса вправе:
            </p>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              <li>Изменять функционал, дизайн и тарифы с уведомлением.</li>
              <li>Приостанавливать доступ при нарушениях или технических работах.</li>
              <li>Использовать анонимизированные данные для улучшения Сервиса.</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              Владелец Сервиса обязуется:
            </p>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              <li>Обеспечивать доступность Сервиса (uptime ≥ 99 %).</li>
              <li>Защищать данные в соответствии с Политикой конфиденциальности.</li>
              <li>Не нести ответственность за убытки от использования прогнозов.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold">5. Оплата услуг</h2>
            <p className="mt-2 text-muted-foreground">
              Платные тарифы оплачиваются через платежные системы (ЮKassa). Оплата является предоплатой. Тарифы и условия оплаты указаны на сайте и могут изменяться.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">6. Интеллектуальная собственность</h2>
            <p className="mt-2 text-muted-foreground">
              Все права на Сервис, включая код, дизайн и алгоритмы, принадлежат Владельцу. Пользователь получает неисключительную лицензию на использование в личных целях. Запрещено реверс-инжиниринг или коммерческое использование.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">7. Ответственность</h2>
            <p className="mt-2 text-muted-foreground">
              Владелец не несет ответственности за косвенные убытки, упущенную выгоду или ошибки в прогнозах. Общая ответственность ограничена суммой, уплаченной Пользователем за последний месяц. Пользователь несет ответственность за нарушения Правил.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">8. Прекращение доступа</h2>
            <p className="mt-2 text-muted-foreground">
              Доступ может быть прекращен по инициативе Пользователя (удаление аккаунта) или Владельца (при нарушениях с уведомлением). Данные удаляются в течение 30 дней.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">9. Применимое право и разрешение споров</h2>
            <p className="mt-2 text-muted-foreground">
              Правила регулируются законодательством РФ. Споры разрешаются в суде по месту регистрации Владельца. Досудебный порядок: претензия на email в течение 30 дней.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">10. Изменения Правил</h2>
            <p className="mt-2 text-muted-foreground">
              Владелец вправе изменять Правила с публикацией на сайте. Продолжение использования означает согласие.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">11. Контакты</h2>
            <p className="mt-2 text-muted-foreground">
              По вопросам: <a href="mailto:support@finpilot.ru" className="text-primary hover:underline">support@finpilot.ru</a>.
            </p>
          </section>
        </div>
        <div className="mt-12">
          <Link href="/" className="text-primary hover:underline">← На главную</Link>
        </div>
      </main>
    </div>
  );
}