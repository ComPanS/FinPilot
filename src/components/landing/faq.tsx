"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "Насколько безопасны мои финансовые данные?",
      answer:
        "Мы используем шифрование AES-256 для защиты всех данных. Сервис соответствует требованиям 152-ФЗ и GDPR. Ваши данные хранятся на защищённых серверах и никогда не передаются третьим лицам.",
    },
    {
      question: "Как работает прогноз денежных потоков?",
      answer:
        "Вы вносите запланированные доходы и расходы (разовые и повторяющиеся). Система автоматически рассчитывает баланс на каждый день в течение 90 дней, учитывая все операции. Алгоритм выявляет дни, когда баланс может уйти в минус — это кассовые разрывы.",
    },
    {
      question: "Можно ли импортировать данные из Excel?",
      answer:
        "Да, в тарифах Standard и Pro доступен импорт данных из Excel. Вы можете загрузить таблицу с операциями, и система автоматически распознает и добавит их в прогноз. Поддерживаются популярные форматы Excel.",
    },
    {
      question: "Есть ли бесплатная версия?",
      answer:
        "Да, бесплатный план Free позволяет создать прогноз на 30 дней для одного профиля бизнеса. Этого достаточно, чтобы оценить основные возможности сервиса. Также все платные планы включают 14-дневный бесплатный пробный период.",
    },
    {
      question: "Что делает ИИ-ассистент?",
      answer:
        "ИИ-ассистент анализирует ваш прогноз и даёт конкретные рекомендации: когда лучше отложить крупную покупку, как избежать кассового разрыва, с какими контрагентами договориться об отсрочке. Это как финансовый советник, доступный 24/7.",
    },
    {
      question: "Можно ли вести учёт для нескольких бизнесов?",
      answer:
        "Да, в тарифах Standard (до 3 профилей) и Pro (до 5 профилей) вы можете создавать отдельные профили для разных бизнесов или проектов. Каждый профиль имеет свой независимый прогноз.",
    },
  ];

  return (
    <section id="faq" className="py-20 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Часто задаваемые вопросы
          </h2>
          <p className="text-lg text-muted-foreground">
            Всё, что нужно знать о ФинПланер
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-surface rounded-xl border border-border overflow-hidden hover:border-primary transition-colors"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-background transition-colors cursor-pointer"
              >
                <span className="font-semibold text-foreground pr-8">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`text-primary flex-shrink-0 transition-transform duration-300 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                  size={24}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? "max-h-96" : "max-h-0"
                }`}
              >
                <div className="px-6 pb-5 text-muted-foreground leading-relaxed">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
