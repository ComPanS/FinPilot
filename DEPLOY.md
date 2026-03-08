# Деплой на VPS (ffinplaner.ru)

## Требования

- VPS с Ubuntu 22.04+ (или аналог)
- Docker и Docker Compose
- Домен ffinplaner.ru, указывающий на IP сервера

**DNS (важно!):** Чтобы работал и `ffinplaner.ru`, и `www.ffinplaner.ru`:
- **A @** → IP вашего VPS
- **A www** (или CNAME www) → тот же IP

Если работает только www — скорее всего, нет A-записи для корневого домена.

## 1. Подготовка сервера

```bash
# Установка Docker (если нет)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Перелогиниться

# Установка Docker Compose
sudo apt install docker-compose-plugin -y
```

## 2. Клонирование и настройка

```bash
cd /var/www/  # или другая директория
git clone https://github.com/YOUR_USER/FinPilot.git
cd FinPilot
```

## 3. Переменные окружения

```bash
cp .env.example .env
nano .env
```

Заполнить:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — для PostgreSQL
- `AUTH_SECRET` — `npx auth secret`
- `ENCRYPTION_KEY` — `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- `CRON_SECRET` — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `AUTH_TRUST_HOST=true`
- `NEXTAUTH_URL` — `https://ffinplaner.ru`
- `NEXT_PUBLIC_APP_URL` — `https://ffinplaner.ru`
- `AUTH_YANDEX_ID`, `AUTH_YANDEX_SECRET` — OAuth Яндекс
- `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` — ЮKassa
- `NEUROAPI_API_KEY` — NEUROAPI
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis
- `SMTP_*` — почта

## 4. Запуск приложения

```bash
docker compose up -d
```

Проверка: `curl http://localhost:3000/api/health`

## 5. Nginx и SSL

**Шаг 1.** Сначала — конфиг без SSL (сертификатов ещё нет):

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
sudo cp deploy/nginx.conf.initial /etc/nginx/sites-available/ffinplaner
sudo ln -s /etc/nginx/sites-available/ffinplaner /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**Шаг 2.** Получить сертификат (certbot добавит SSL в конфиг):

```bash
sudo certbot --nginx -d ffinplaner.ru -d www.ffinplaner.ru
```

**Шаг 3.** (Опционально) Заменить на полный конфиг с редиректом HTTP→HTTPS:

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/ffinplaner
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Cron (продление подписок)

```bash
crontab -e
```

Добавить (ежедневно в 05:00):

```
0 5 * * * /opt/FinPilot/deploy/cron-setup.sh
```

Либо напрямую:

```
0 5 * * * curl -s -H "Authorization: Bearer ВАШ_CRON_SECRET" https://ffinplaner.ru/api/cron/renew-subscriptions
```

## 7. Проверка

- https://ffinplaner.ru — открывается
- Регистрация и вход работают
- Cron: вручную вызвать `/api/cron/renew-subscriptions` с Bearer-токеном
