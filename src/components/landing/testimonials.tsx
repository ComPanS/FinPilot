import { Star } from "lucide-react";

export function Testimonials() {
  const testimonials = [
    {
      name: "Алексей Соколов",
      role: "Владелец цифрового агентства",
      content:
        "ФинПланер помог мне выявить кассовый разрыв на 2 месяца вперёд. Успел договориться с банком о кредите. Это спасло бизнес.",
      avatar: "АС",
    },
    {
      name: "Мария Волкова",
      role: "ИП, интернет-магазин",
      content:
        "Раньше тратила часы на Excel. Теперь весь прогноз делается за 5 минут. Рекомендации ИИ действительно полезные и конкретные.",
      avatar: "МВ",
    },
    {
      name: "Дмитрий Кузнецов",
      role: "Кафе и ресторан",
      content:
        "Режим 'Что если' — это просто находка! Могу сразу увидеть, что будет, если задержат оплату или придётся купить новое оборудование.",
      avatar: "ДК",
    },
  ];

  return (
    <section className="py-20 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Что говорят предприниматели
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Реальные отзывы владельцев малого бизнеса
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-surface rounded-xl p-4 sm:p-6 lg:p-8 border border-border hover:border-primary hover:shadow-lg transition-all duration-300"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="text-warning fill-current"
                    size={18}
                  />
                ))}
              </div>

              <p className="text-foreground mb-6 leading-relaxed">
                &quot;{testimonial.content}&quot;
              </p>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-semibold">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-foreground">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
