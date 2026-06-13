## Beschreibung

<!-- Kurze Zusammenfassung der Änderungen. Was wurde geändert und warum? -->

## Art der Änderung

- [ ] 🐛 Bugfix (behebt ein Problem ohne Breaking Change)
- [ ] ✨ Feature (neue Funktionalität ohne Breaking Change)
- [ ] 💥 Breaking Change (bestehende Funktionalität ändert sich inkompatibel)
- [ ] 📚 Dokumentation
- [ ] 🔧 Refactoring (kein Behavior-Change)
- [ ] 🔒 Security (sicherheitsrelevante Änderung)
- [ ] 🏗️ Infrastruktur / CI

## Betroffene Komponenten

- [ ] `rust/ozy-contracts`
- [ ] `rust/ozy-core`
- [ ] `rust/ozy-bindings`
- [ ] `backend/`
- [ ] `frontend/`
- [ ] `docs/`
- [ ] `infra/` (docker-compose, nginx, CI)

## Checkliste

### Allgemein
- [ ] Code ist selbst-beschreibend oder kommentiert
- [ ] Keine Debug-Logs, kein auskommentierter Code hinterlassen
- [ ] `.env` wurde **nicht** committet

### Rust
- [ ] `cargo fmt` ausgeführt — kein Formatierungsdrift
- [ ] `cargo clippy --all-targets -- -D warnings` fehlerfrei
- [ ] `cargo test --workspace` grün
- [ ] Kein `unwrap()` in Produktionscode

### Python
- [ ] `ruff check app tests` fehlerfrei
- [ ] `ruff format app tests` ausgeführt
- [ ] `mypy` fehlerfrei
- [ ] `pytest -q tests/` grün

### Frontend
- [ ] `npm run typecheck` fehlerfrei
- [ ] `npm run test` grün

### Sicherheit & Privacy
- [ ] S3/S4-Daten werden weiterhin korrekt geroutet (nur lokal)
- [ ] Write-Gates sind nicht umgangen worden
- [ ] Neue API-Endpunkte sind durch JWT geschützt
- [ ] Audit-Logging ist für sicherheitsrelevante Aktionen vorhanden
- [ ] `AUTH_DEV_BYPASS` ist **nicht** für Produktions-Funktionalität erforderlich

## Verknüpfte Issues

Closes #<!-- Issue-Nummer -->

## Testplan

<!-- Wie wurde diese Änderung getestet? Welche Szenarien wurden abgedeckt? -->

## Screenshots / Logs (optional)

<!-- Bei UI-Änderungen: Before/After Screenshots -->
<!-- Bei komplexen Fehlern: Relevante Logs -->
