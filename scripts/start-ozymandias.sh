#!/usr/bin/env bash
# Ozymandias quick start for a desktop shortcut.
# Shortcut example (Linux .desktop):
#   Exec=bash /path/to/ozymandias/scripts/start-ozymandias.sh
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.."

if docker compose up -d; then
    :
elif docker-compose up -d; then
    :
else
    echo "Konnte den Stack nicht starten. Bitte Docker Desktop starten und erneut versuchen." >&2
    exit 1
fi

URL="http://localhost:8080"

if [[ "$OSTYPE" == "darwin"* ]]; then
    open "$URL"
elif command -v xdg-open &>/dev/null; then
    xdg-open "$URL"
fi

echo "Ozymandias wurde gestartet. Browser geoeffnet: $URL"
