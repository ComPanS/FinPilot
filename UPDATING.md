# Обновление продакшена

```bash
cd /var/www/FinPilot
mv deploy/nginx.conf.initial deploy/nginx.conf.initial.bak
git pull
docker compose build app
docker compose up -d
```

## Если сайт не обновляется

1. **Сборка с нуля** — Docker кэширует слои, старый образ мог подхватиться:
   ```bash
   docker compose build --no-cache app
   docker compose up -d --force-recreate app
   ```

2. **Проверить, что новый код попал в образ**:
   ```bash
   docker compose exec app ls -la /app/.next/standalone
   # или посмотреть дату билда
   docker images | grep finpilot
   ```

3. **Очистить старые образы** (если контейнер всё ещё на старом):
   ```bash
   docker compose down
   docker compose build --no-cache app
   docker compose up -d
   ```

4. **Кэш браузера** — Ctrl+Shift+R или открыть в режиме инкогнито.

5. **Кэш Nginx** — если настроен proxy_cache:
   ```bash
   sudo nginx -s reload
   ```
