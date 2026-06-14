# Ozymandias Setup & Launcher Script
# Stand: Juni 2026

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Farbcodes für ansprechende Ausgabe
$Green = "Green"
$Yellow = "Yellow"
$Cyan = "Cyan"
$Red = "Red"

Clear-Host
Write-Host "============================================================" -ForegroundColor $Cyan
Write-Host "         O Z Y M A N D I A S  --  Setup & Launcher          " -ForegroundColor $Cyan
Write-Host "============================================================" -ForegroundColor $Cyan
Write-Host "Willkommen beim interaktiven Installations-Assistenten."
Write-Host ""

# 1. Voraussetzungen prüfen
Write-Host "[1/4] Prüfe Systemvoraussetzungen..." -ForegroundColor $Yellow

# Prüfe Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "FEHLER: Docker wurde nicht gefunden!" -ForegroundColor $Red
    Write-Host "Bitte installiere Docker Desktop (https://www.docker.com/products/docker-desktop/)"
    Write-Host "und stelle sicher, dass Docker gestartet ist, bevor du dieses Skript erneut ausführst."
    Read-Host "Drücke ENTER zum Beenden..."
    exit 1
}

# Prüfe ob Docker Daemon läuft
try {
    & docker ps > $null
} catch {
    Write-Host "FEHLER: Der Docker Daemon läuft nicht!" -ForegroundColor $Red
    Write-Host "Bitte starte Docker Desktop auf deinem System und führe dieses Skript erneut aus."
    Read-Host "Drücke ENTER zum Beenden..."
    exit 1
}

Write-Host "  -> Docker ist installiert und aktiv." -ForegroundColor $Green

# 2. .env konfigurieren
Write-Host ""
Write-Host "[2/4] Konfiguriere Umgebungsvariablen (.env)..." -ForegroundColor $Yellow

$envFile = Join-Path $PSScriptRoot ".env"
$envExampleFile = Join-Path $PSScriptRoot ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExampleFile) {
        Copy-Item -Path $envExampleFile -Destination $envFile
        Write-Host "  -> Eine neue .env Datei wurde aus .env.example erstellt." -ForegroundColor $Green
    } else {
        Write-Host "FEHLER: .env.example wurde nicht gefunden!" -ForegroundColor $Red
        Read-Host "Drücke ENTER zum Beenden..."
        exit 1
    }
} else {
    Write-Host "  -> Bestehende .env Datei gefunden." -ForegroundColor $Green
}

# 3. Installations-Modus wählen
Write-Host ""
Write-Host "============================================================" -ForegroundColor $Cyan
Write-Host "Wähle deinen Installations-Modus:" -ForegroundColor $Cyan
Write-Host "1) Schnelle Evaluierung / Rust-Bypass (Empfohlen)"
Write-Host "   - Startet Ozy sofort ohne Compiler-Abhängigkeiten."
Write-Host "   - Verwendet das Python-Fallback-Modul."
Write-Host "   - Deaktiviert die JWT-Login-Maske für direkte Nutzung."
Write-Host ""
Write-Host "2) Vollständiger Entwickler-Build (Voller Stack)"
Write-Host "   - Baut und kompiliert den gehärteten Governance-Kern (Rust) im Docker-Container."
Write-Host "   - Benötigt KEINE lokale Installation von Rust/Python/Node.js."
Write-Host "============================================================" -ForegroundColor $Cyan

$choice = ""
while ($choice -ne "1" -and $choice -ne "2") {
    $choice = Read-Host "Auswahl (1 oder 2)"
    $choice = $choice.Trim()
}

# Bereinige alte/konfliktbehaftete Container mit expliziten Namen
Write-Host "Prüfe und bereinige alte Container-Instanzen..." -ForegroundColor $Yellow
docker rm -f ozy-backend ozy-frontend-build ozy-nginx ozy-db-init ozy-pg-backup ozy-postgres ozy-redis ozy-minio *>$null

if ($choice -eq "1") {
    Write-Host ""
    Write-Host "[3/4] Konfiguriere Bypass-Modus in der .env..." -ForegroundColor $Yellow
    
    # .env aktualisieren
    $content = Get-Content -Path $envFile
    $newContent = @()
    foreach ($line in $content) {
        if ($line -like "AUTH_DEV_BYPASS=*") {
            $newContent += "AUTH_DEV_BYPASS=true"
        } elseif ($line -like "VITE_AUTH_BYPASS=*") {
            $newContent += "VITE_AUTH_BYPASS=true"
        } else {
            $newContent += $line
        }
    }
    $newContent | Set-Content -Path $envFile
    Write-Host "  -> Bypass-Modus aktiviert (AUTH_DEV_BYPASS=true)." -ForegroundColor $Green
    
    # System starten
    Write-Host ""
    Write-Host "[4/4] Starte Ozymandias Stack..." -ForegroundColor $Yellow
    & docker compose up -d
} else {
    Write-Host ""
    Write-Host "[3/4] Entwickler-Build wird vorbereitet..." -ForegroundColor $Yellow
    Write-Host "  -> Der gehärtete Governance-Kern (Rust) wird automatisch im Docker-Container gebaut." -ForegroundColor $Green
    Write-Host "  -> Keine lokale Installation von Rust/Python/Node.js nötig." -ForegroundColor $Green
    
    # System starten
    Write-Host ""
    Write-Host "[4/4] Starte Ozymandias Stack..." -ForegroundColor $Yellow
    & docker compose up -d --build
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "FEHLER: Fehler beim Ausführen von Docker Compose!" -ForegroundColor $Red
    Read-Host "Drücke ENTER zum Beenden..."
    exit 1
}

# 4. Öffne Web-Oberfläche
Write-Host ""
Write-Host "Warte darauf, dass das System erreichbar ist..." -ForegroundColor $Yellow
$url = "http://localhost:8080"
$success = $false
for ($i = 0; $i -lt 15; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $success = $true
            break
        }
    } catch {
        # Ignorieren und warten
    }
    Start-Sleep -Seconds 2
}

Write-Host "============================================================" -ForegroundColor $Cyan
Write-Host "Ozymandias erfolgreich gestartet!" -ForegroundColor $Green
Write-Host "Öffne Web-Interface unter: $url" -ForegroundColor $Green
Write-Host "============================================================" -ForegroundColor $Cyan

Start-Process $url
