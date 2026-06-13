# ADR-001: Repo-Reorganisation Phase 0

**Status:** Accepted  
**Datum:** 2026-04-11  
**Kontext:** Die Root-Ebene des Repos war mit 30+ `CURSOR_STARTPROMPT_*.md` Dateien überfrachtet. Docs waren flach in einem einzigen Verzeichnis.

## Entscheidung

1. Alle `CURSOR_*.md`-Dateien nach `docs/prompts/` verschoben (Archiv, nicht gelöscht).
2. `docs/` in Unterverzeichnisse aufgeteilt:
   - `spec/` — Kern-Spezifikationen (Memory, Write-Gates, Contracts, DB-Schema, etc.)
   - `api/` — API-Referenz, Frontend-Doku
   - `deployment/` — Deployment, Backup, Monitoring
   - `adr/` — Architecture Decision Records
   - `prompts/` — Cursor-AI-Prompts (historisch)
3. `ARCHITECTURE.md` bleibt auf Top-Level in `docs/` (Einstiegspunkt).
4. `INDEX.md` als zentrale Navigation aktualisiert.

## Konsequenzen

- Sauberere Root-Ebene, nur noch relevante Dateien sichtbar.
- Entwickler finden Docs schneller durch klare Kategorisierung.
- Alte Cursor-Prompts bleiben erhalten, stören aber nicht mehr.
