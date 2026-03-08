import { Star } from "lucide-react";

export function Testimonials() {
  const testimonials = [
    {
      name: "Алексей Соколов",
      role: "Владелец цифрового агентства",
      content: "ФинПланер помог мне выявить кассовый разрыв на 2 месяца вперёд. Успел договориться с банком о кредите. Это спасло бизнес.",
      avatar: "АС",
    },
    {
      name: "Мария Волкова",
      role: "ИП, интернет-магазин",
      content: "Раньше тратила часы на Excel. Теперь весь прогноз делается за 5 минут. Рекомендации ИИ действительно полезные и конкретные.",
      avatar: "МВ",
    },
    {
      name: "Дмитрий Кузнецов",
      role: "Кафе и ресторан",
      content: "Режим 'Что если' — это просто находка! Могу сразу увидеть, что будет, если задержат оплату или придётся купить новое оборудование.",
      avatar: "ДК",
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] mb-4">
            Что говорят предприниматели
          </h2>
          <p className="text-lg text-[#475569] max-w-2xl mx-auto">
            Реальные отзывы владельцев малого бизнеса
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-8 border border-[#E2E8F0] hover:border-[#10B981] hover:shadow-lg transition-all duration-300"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="text-[#F59E0B] fill-current"
                    size={18}
                  />
                ))}
              </div>

              {/* Content */}
              <p className="text-[#0F172A] mb-6 leading-relaxed">
                &quot;{testimonial.content}&quot;
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#10B981] text-white flex items-center justify-center font-semibold">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-[#0F172A]">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-[#475569]">
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
