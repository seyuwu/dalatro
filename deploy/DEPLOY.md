# dotora (dalatro) — деплой на VPS Selectel, рядом с logITika и opinia

**Статус: в проде с 13.09.2026 — [https://dotora.ru](https://dotora.ru) (Docker, `/opt/dotora`, порт 8891, certbot `dotora.ru` + www, бэкап-крон 03:10). Обновление: `git push` → на сервере `/opt/dotora/deploy/deploy.sh`. Пароль админки печатался в `docker logs dotora-prod` при первом старте.**

Тот же сервер `136.234.5.192`, третий проект. Главное отличие от соседей:
**нет своей БД и отдельного API-поддомена** — один Node-процесс отдаёт и
статика, и `/api/*`, данные — JSON-файлы в `data/` (bind-mount).

| | logITika | opinia | **dotora** |
|---|---|---|---|
| Путь | `/opt/logitika` | `/opt/opinia` | `/opt/dotora` |
| Loopback | `127.0.0.1:8888` | `127.0.0.1:8889/8890` | `127.0.0.1:8891` |
| БД | postgres `5434` | postgres/redis/minio | **нет — `data/*.json`** |
| Домены | logitika.ru | opinia.ru + 4 поддомена | `<домен>` + www |
| Репо | приватный | публичный | публичный (`github.com/seyuwu/dalatro`) |

## 1. Домен и DNS (делается один раз)

1. Купить домен (где угодно).
2. В панели регистратора выставить NS Selectel — как у opinia.ru:
   `a.ns.selectel.ru` … `d.ns.selectel.ru`.
3. В DNS-хостинге Selectel добавить A-записи на `136.234.5.192`:

   | Имя | Тип | Значение |
   |---|---|---|
   | `@` | A | `136.234.5.192` |
   | `www` | A | `136.234.5.192` |

   Отдельный `api.` не нужен — API на том же домене.
4. Делегирование .ru живёт от пары часов до суток. Проверка:
   `nslookup <домен> a.ns.selectel.ru`, потом через `8.8.8.8`.

## 2. Первый деплой на сервер

```bash
ssh -i ~/.ssh/logitika_deploy root@136.234.5.192   # ключ общий на сервер

cd /opt && git clone https://github.com/seyuwu/dalatro.git dotora && cd dotora
mkdir -p data && chown 1000:1000 data && chmod 700 data  # контейнер работает под node (uid 1000)
docker compose up -d --build
curl -s http://127.0.0.1:8891/api/leaderboard?limit=1   # → {"view":"score","rows":[…]}
```

Пароль админки при первом старте генерируется и печатается в консоль:
`docker logs dotora-prod | grep Админка`. Свой вариант — до первого старта:
`DOTORA_ADMIN_PASSWORD=...` через `environment:` в compose (файл
`data/admin.json` тогда удалить, если успел создаться).

## 3. nginx + SSL

1. `cp deploy/nginx-dotora.conf.example /etc/nginx/sites-available/dotora`,
   заменить `<домен>`, но пока оставить только `listen 80`-блок.
2. `ln -sf /etc/nginx/sites-available/dotora /etc/nginx/sites-enabled/`
   → `nginx -t && systemctl reload nginx`.
3. Сертификат (DNS уже должен смотреть на сервер):
   `certbot certonly --webroot -w /var/www/certbot -d <домен> -d www.<домен> --email <почта> --agree-tos --no-eff-email`
4. Раскомментировать 443-блок → `nginx -t && systemctl reload nginx`.
   Автопродление общее: `certbot renew --dry-run`.

Проверка соседей после любых правок nginx: `curl -I https://logitika.ru`
и `curl -s https://opinia.ru/api/health` — должны отвечать.

## 4. Цикл обновления

```
ПК:  git add -A && git commit && git push          # как обычно
серв: /opt/dotora/deploy/deploy.sh                  # pull → build → prune
```

Клон по HTTPS — репо публичный, ключи на сервере не нужны (как у opinia).
`data/` при пересборке не трогается. Данные админки `data/admin.json`
и пароль в логах переживают обновления.

## 5. Бэкап

Вся «база» — `data/*.json`, бэкап = tar:

```bash
/opt/dotora/deploy/backup-data.sh          # backups/dotora-data-YYYY-MM-DD.tar.gz, ротация 7 дней
# крон: 10 3 * * * /opt/dotora/deploy/backup-data.sh   (03:00 logITika, 03:30 opinia — не пересекаемся)
```

Восстановление: распаковать tar в `data/`, `docker compose restart`.

Off-site копия: пока не настроена (тот же открытый вопрос, что у opinia).
Минимальный вариант — раз в сутки забирать свежий tar со сервера по SCP
на ПК: `scp -i ~/.ssh/logitika_deploy root@136.234.5.192:/opt/dotora/backups/dotora-data-$(date +%F).tar.gz .`

## 6. Типичные проблемы

| Симптом | Решение |
|---|---|
| 502 от nginx | `docker compose ps` — контейнер unhealthy/не запущен; `docker logs dotora-prod` |
| Порт 8891 занят | `ss -tlnp \| grep 8891` — наши порты: 8888/5434 (logITika), 8889/8890 (opinia), 8891 (dotora) |
| Забыли пароль админки | `docker logs dotora-prod \| grep Админка` (печатался при создании); либо удалить `data/admin.json` и перезапустить — новый пароль в логах |
| Ошибки записи в data/ | права на хосте: `chown -R 1000:1000 data/` (контейнер работает под node, uid 1000) |
| `nginx -t` failed | **не** делать `reload` — упадут все три сайта; править конфиг |

## 7. Чеклист после выката

- [ ] `https://<домен>` открывается, титул игры на месте
- [ ] Регистрация аккаунта работает, забег пишется в «Зал славы» (Онлайн)
- [ ] `https://<домен>/admin` — вход, дашборд показывает трафик
- [ ] `curl -I https://logitika.ru` и opinia — живы
- [ ] Бэкап-крон добавлен, тестовый tar снят
