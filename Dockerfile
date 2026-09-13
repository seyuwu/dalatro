# dotora — образ прод-сервера. Node 22, ноль зависимостей: один процесс
# раздаёт статику (index.html + src/*.js) и принимает /api/*.
# Сборка: docker compose up -d --build  (см. deploy/DEPLOY.md)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Внутри контейнера слушаем все интерфейсы: проброс портов Docker идёт
# на IP контейнера, а не на его loopback. Наружу торчит только host-порт
# 127.0.0.1 из compose.
ENV HOST=0.0.0.0

COPY package.json server.js analytics.js admin.js index.html ./
COPY src ./src
COPY images ./images

# data/ (аккаунты, забеги, аналитика) — bind-mount с хоста в compose:
# переживает пересборку образа, бэкап = tar каталога на хосте.
# Не-root: в образе есть пользователь node (uid 1000) — эскалация из
# процесса в контейнере не даёт root. На хосте владелец data/ — uid 1000:
#   mkdir -p data && chown 1000:1000 data
USER node

EXPOSE 8787
CMD ["node", "server.js"]
