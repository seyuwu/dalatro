#!/usr/bin/env bash
# dotora — обновление прода: pull → пересборка → чистка старых образов.
# Запуск на сервере: /opt/dotora/deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── git pull"
git pull origin main

echo "── пересборка и перезапуск (data/ не трогается)"
docker compose up -d --build

echo "── чистка висячих образов"
docker image prune -f

echo "── статус"
docker compose ps
curl -s -o /dev/null -w "локальный ответ: %{http_code}\n" http://127.0.0.1:8891/api/leaderboard?limit=1
