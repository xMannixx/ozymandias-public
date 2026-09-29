#!/usr/bin/env bash
# Ozymandias quick start for a desktop shortcut.
# Shortcut example (Linux .desktop):
#   Exec=/path/to/ozymandias/scripts/start-ozymandias.sh
#   Terminal=false
set -uo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.." || exit 1

URL="http://localhost:8080"
ICON="$PWD/frontend/public/icon-512.png"

# Without a terminal the only feedback channel is a desktop notification.
notify() {
    echo "$2"
    if command -v notify-send &>/dev/null; then
        notify-send -u "$1" -i "$ICON" Ozymandias "$2"
    fi
}

notify normal "Wird gestartet ..."

if docker compose up -d; then
    :
elif docker-compose up -d; then
    :
else
    notify critical "Konnte den Stack nicht starten. Bitte Docker starten und erneut versuchen."
    exit 1
fi

# Nginx answers before the backend is up; opening the browser right away shows a 502.
for _ in $(seq 1 60); do
    curl -sf -o /dev/null "$URL/health" && break
    sleep 2
done

if ! curl -sf -o /dev/null "$URL/health"; then
    notify critical "Gestartet, aber $URL antwortet nach 2 Minuten noch nicht."
    exit 1
fi

if [[ "$OSTYPE" == "darwin"* ]]; then
    open "$URL"
elif command -v xdg-open &>/dev/null; then
    xdg-open "$URL"
fi

echo "Ozymandias wurde gestartet. Browser geoeffnet: $URL"
