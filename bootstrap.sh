#!/usr/bin/env bash
# Ozymandias Setup & Launcher Script
# Stand: Juni 2026
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

clear
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}         O Z Y M A N D I A S  --  Setup & Launcher          ${NC}"
echo -e "${CYAN}============================================================${NC}"
echo "Willkommen beim interaktiven Installations-Assistenten."
echo ""

# 1. Voraussetzungen prüfen
echo -e "${YELLOW}[1/4] Prüfe Systemvoraussetzungen...${NC}"

if ! command -v docker &>/dev/null; then
    echo -e "${RED}FEHLER: Docker wurde nicht gefunden!${NC}"
    echo "Bitte installiere Docker Desktop (https://www.docker.com/products/docker-desktop/)"
    echo "und stelle sicher, dass Docker gestartet ist, bevor du dieses Skript erneut ausführst."
    read -rp "Drücke ENTER zum Beenden..."
    exit 1
fi

if ! docker ps &>/dev/null; then
    echo -e "${RED}FEHLER: Der Docker Daemon läuft nicht!${NC}"
    echo "Bitte starte Docker Desktop auf deinem System und führe dieses Skript erneut aus."
    read -rp "Drücke ENTER zum Beenden..."
    exit 1
fi

echo -e "${GREEN}  -> Docker ist installiert und aktiv.${NC}"

# 2. .env konfigurieren
echo ""
echo -e "${YELLOW}[2/4] Konfiguriere Umgebungsvariablen (.env)...${NC}"

ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"

if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        echo -e "${GREEN}  -> Eine neue .env Datei wurde aus .env.example erstellt.${NC}"
    else
        echo -e "${RED}FEHLER: .env.example wurde nicht gefunden!${NC}"
        read -rp "Drücke ENTER zum Beenden..."
        exit 1
    fi
else
    echo -e "${GREEN}  -> Bestehende .env Datei gefunden.${NC}"
fi

# 3. Installations-Modus wählen
echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}Wähle deinen Installations-Modus:${NC}"
echo "1) Schnelle Evaluierung / Rust-Bypass (Empfohlen)"
echo "   - Startet Ozy sofort ohne Compiler-Abhängigkeiten."
echo "   - Verwendet das Python-Fallback-Modul."
echo "   - Deaktiviert die JWT-Login-Maske für direkte Nutzung."
echo ""
echo "2) Vollständiger Entwickler-Build (Voller Stack)"
echo "   - Baut und kompiliert den gehärteten Governance-Kern (Rust) im Docker-Container."
echo "   - Benötigt KEINE lokale Installation von Rust/Python/Node.js."
echo -e "${CYAN}============================================================${NC}"

CHOICE=""
while [[ "$CHOICE" != "1" && "$CHOICE" != "2" ]]; do
    read -rp "Auswahl (1 oder 2): " CHOICE
    CHOICE="${CHOICE// /}"
done

# Bereinige alte/konfliktbehaftete Container
echo -e "${YELLOW}Prüfe und bereinige alte Container-Instanzen...${NC}"
docker rm -f ozy-backend ozy-frontend-build ozy-nginx ozy-db-init ozy-pg-backup ozy-postgres ozy-redis ozy-minio 2>/dev/null || true

if [ "$CHOICE" = "1" ]; then
    echo ""
    echo -e "${YELLOW}[3/4] Konfiguriere Bypass-Modus in der .env...${NC}"

    # sed -i verhält sich unter macOS (BSD) anders als unter Linux (GNU)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's/^AUTH_DEV_BYPASS=.*/AUTH_DEV_BYPASS=true/' "$ENV_FILE"
        sed -i '' 's/^VITE_AUTH_BYPASS=.*/VITE_AUTH_BYPASS=true/' "$ENV_FILE"
    else
        sed -i 's/^AUTH_DEV_BYPASS=.*/AUTH_DEV_BYPASS=true/' "$ENV_FILE"
        sed -i 's/^VITE_AUTH_BYPASS=.*/VITE_AUTH_BYPASS=true/' "$ENV_FILE"
    fi

    echo -e "${GREEN}  -> Bypass-Modus aktiviert (AUTH_DEV_BYPASS=true).${NC}"

    echo ""
    echo -e "${YELLOW}[4/4] Starte Ozymandias Stack...${NC}"
    docker compose up -d
else
    echo ""
    echo -e "${YELLOW}[3/4] Entwickler-Build wird vorbereitet...${NC}"
    echo -e "${GREEN}  -> Der gehärtete Governance-Kern (Rust) wird automatisch im Docker-Container gebaut.${NC}"
    echo -e "${GREEN}  -> Keine lokale Installation von Rust/Python/Node.js nötig.${NC}"

    echo ""
    echo -e "${YELLOW}[4/4] Starte Ozymandias Stack...${NC}"
    docker compose up -d --build
fi

# 4. Warten bis das System erreichbar ist
URL="http://localhost:8080"
echo ""
echo -e "${YELLOW}Warte darauf, dass das System erreichbar ist...${NC}"
for i in $(seq 1 15); do
    if curl -sf --max-time 2 "$URL" &>/dev/null; then
        break
    fi
    sleep 2
done

echo -e "${CYAN}============================================================${NC}"
echo -e "${GREEN}Ozymandias erfolgreich gestartet!${NC}"
echo -e "${GREEN}Öffne Web-Interface unter: $URL${NC}"
echo -e "${CYAN}============================================================${NC}"

# Browser öffnen
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "$URL"
elif command -v xdg-open &>/dev/null; then
    xdg-open "$URL"
fi
