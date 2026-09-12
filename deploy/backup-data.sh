#!/usr/bin/env bash
# dotora — бэкап данных (accounts.json, runs.json, analytics.json, admin.json).
# Весь «бэкап базы» — это tar каталога data/: там только JSON-файлы.
# Крон: 10 3 * * *  /opt/dotora/deploy/backup-data.sh   (logITika 03:00, opinia 03:30)
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p backups
tar -czf "backups/dotora-data-$(date +%F).tar.gz" data/
ls -1t backups/dotora-data-*.tar.gz | tail -n +8 | xargs -r rm -f   # ротация 7 дней
echo "бэкап готов: backups/dotora-data-$(date +%F).tar.gz"
