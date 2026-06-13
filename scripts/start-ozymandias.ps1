# Ozymandias quick start for a desktop shortcut.
# Shortcut target example:
# powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\mfrit\Documents\Ozymandias\scripts\start-ozymandias.ps1"

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -Path $repoRoot

function Invoke-ComposeUp {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        & docker compose up -d
        if ($LASTEXITCODE -eq 0) {
            return
        }
    }

    if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
        & docker-compose up -d
        if ($LASTEXITCODE -eq 0) {
            return
        }
    }

    throw "Konnte den Stack nicht starten. Bitte Docker Desktop starten und erneut versuchen."
}

try {
    Invoke-ComposeUp
    Start-Process "http://localhost:8080"
    Write-Host "Ozymandias wurde gestartet. Browser geoeffnet: http://localhost:8080"
} catch {
    Write-Error $_
    exit 1
}
