# Contributing to Ozymandias

Ozymandias ist ein persönliches KI-Assistent-Projekt. Dieses Dokument beschreibt, wie Änderungen am Code vorgenommen werden — sowohl für menschliche Entwickler als auch für KI-Agenten (Cursor, Copilot etc.).

---

## Inhaltsverzeichnis

- [Grundprinzipien](#grundprinzipien)
- [Vorbedingungen](#vorbedingungen)
- [Branch-Strategie](#branch-strategie)
- [Commit-Konventionen](#commit-konventionen)
- [Code-Standards Rust](#code-standards-rust)
- [Code-Standards Python](#code-standards-python)
- [Code-Standards Frontend](#code-standards-frontend)
- [Tests schreiben](#tests-schreiben)
- [Pull Request Prozess](#pull-request-prozess)
- [Verbotene Praktiken](#verbotene-praktiken)

---

## Grundprinzipien

Diese Prinzipien gelten immer, ohne Ausnahme:

1. **Fail-closed**: Fehler sind explizit, niemals still ignoriert. Lieber einen harten Fehler als eine unsichere Annahme.
2. **Contracts-first**: Typen-Änderungen in `ozy-contracts` kommen vor Logik-Änderungen in `ozy-core`. Niemals die Implementierung vor dem Vertrag.
3. **Kein `unwrap()` in Produktionscode**: Alle `Result`- und `Option`-Werte werden explizit behandelt. `expect()` ist erlaubt in Tests mit aussagekräftiger Fehlermeldung.
4. **Kein direkter DB-Zugriff durch das LLM**: Jeder Memory-Schreibvorgang geht über den Proposal-Workflow (Write-Gate-Pipeline G1–G5).
5. **Audit-Trail ist Pflicht**: Jede sicherheitsrelevante Aktion wird ins `audit_log` geschrieben — kein stilles Versagen.
6. **S3/S4 nur lokal**: Kein S3/S4-Inhalt darf an Cloud-Provider gesendet werden. Diese Regel ist im Rust-Kern durchgesetzt und darf auf Python-Ebene nicht umgangen werden.
7. **`.env` niemals committen**: Environment-Variablen gehören nicht in den Git-History. `.env.example` als Template verwenden.

---

## Vorbedingungen

Vollständige Versionsanforderungen: [`REQUIREMENTS.md`](REQUIREMENTS.md) · [`docs/OZY_SOFTWARE_VERSIONEN.md`](docs/OZY_SOFTWARE_VERSIONEN.md)

```bash
# Mindestanforderungen
rustc --version    # >= 1.94
python --version   # >= 3.14
node --version     # >= 22 (LTS)
docker --version   # >= 29
```

---

## Branch-Strategie

```
main            — Produktionsstand, nur über PR
feature/<name>  — Neue Features
fix/<name>      — Bugfixes
docs/<name>     — Nur Dokumentation
chore/<name>    — Wartung, Abhängigkeiten, CI
```

**Direkte Commits auf `main` sind gesperrt.**

---

## Commit-Konventionen

Format: `<typ>(<scope>): <beschreibung>` (Conventional Commits)

| Typ | Verwendung |
|---|---|
| `feat` | Neue Funktionalität |
| `fix` | Bugfix |
| `docs` | Nur Dokumentation |
| `test` | Tests hinzufügen oder anpassen |
| `refactor` | Code-Umstrukturierung ohne Behavior-Änderung |
| `chore` | Build, CI, Abhängigkeiten |
| `security` | Sicherheitsrelevante Änderungen |

**Scope-Beispiele:** `rust/contracts`, `rust/core`, `rust/bindings`, `backend/claims`, `backend/llm`, `frontend/chat`, `infra/docker`

**Beispiele:**
```
feat(rust/core): add S4 intent mismatch check in sensitivity router
fix(backend/claims): handle NULL attribute in conflict detection
docs(rust/contracts): add HandlingPolicy enum documentation
chore(infra): pin pgvector image to 0.8.2
```

---

## Code-Standards Rust

### Allgemein

- Edition 2024 in allen Crates
- `cargo fmt` vor jedem Commit — keine Ausnahmen
- `cargo clippy --all-targets -- -D warnings` muss fehlerfrei durchlaufen
- Kein `unwrap()`, kein `expect()` ohne aussagekräftige Meldung außer in Tests
- Alle öffentlichen Typen, Funktionen und Module brauchen `///`-Dokumentation
- Serde `Serialize/Deserialize` für alle Contracts-Typen
- Keine `chrono`-Abhängigkeit in `ozy-contracts` oder `ozy-core` — Timestamps sind `String` (ISO 8601)

### Rust-Workspace-Grenzen (WICHTIG)

| Crate | Was gehört rein | Was gehört NICHT rein |
|---|---|---|
| `ozy-contracts` | Typen, Enums, Error-Types, Structs | Logik, I/O, Async, PyO3-Attribute |
| `ozy-core` | Synchrone Validierungslogik, kein I/O | DB-Zugriffe, HTTP, Async, PyO3 |
| `ozy-bindings` | PyO3-Wrapper, Python-Exposition | Eigene Logik (delegiert an ozy-core) |

### Tests

```bash
cd rust
cargo test --workspace
cargo test --workspace -- --include-ignored  # Auch ignored tests
```

Jede öffentliche Funktion in `ozy-core` braucht mindestens einen Unit-Test. Property-Based Tests mit `proptest` für sicherheitskritische Funktionen (z.B. Decay Engine, Sensitivity Router).

---

## Code-Standards Python

### Allgemein

- Python 3.14+, vollständige Typ-Annotationen überall (`from __future__ import annotations`)
- Pydantic v2 für alle Daten-Schemas
- SQLAlchemy 2.0 (async) für alle DB-Zugriffe
- FastAPI für alle API-Endpunkte
- Keine synchronen DB-Aufrufe — immer `async/await`

### Linting und Formatierung

```bash
cd backend
python -m ruff check app tests        # Linter
python -m ruff format app tests       # Formatter
python -m mypy --config-file pyproject.toml app tests  # Typ-Checks
```

Alle drei müssen fehlerfrei durchlaufen. **`ruff`-Fehler sind PR-Blocker.**

### Service-Layer-Regeln

- Services sind die einzige Stelle, die die DB schreibt
- API-Router delegieren direkt an Services — keine Geschäftslogik in Routern
- Jeder Service bekommt `db: AsyncSession` als Konstruktor-Parameter
- Fehler werden als typisierte Exceptions aus `services/errors.py` geworfen, nicht als generische `Exception`
- Audit-Logging ist Pflicht für alle schreibenden Operationen (Claims, Proposals, Actions)

### Tests

```bash
cd backend
python -m pytest -q tests/
python -m pytest -q tests/ -v --tb=short  # Verbose bei Fehlern
```

Jeder neue API-Endpunkt braucht mindestens einen Integrationstest. Jeder Service-Methode braucht mindestens einen Unit-Test.

---

## Code-Standards Frontend

### Allgemein

- TypeScript 6, strikte Konfiguration (`strict: true` in `tsconfig.json`)
- React 19 Functional Components, kein Class-Component-Neucode
- Tailwind CSS 4 für alle Styles — kein Inline-CSS, keine separaten CSS-Dateien (außer `index.css` für globale Resets)
- Kein `any` in TypeScript — wenn unvermeidbar, explizit kommentieren warum

### Linting

```bash
cd frontend
npm run typecheck  # tsc --noEmit
npm run lint       # tsc --noEmit (Alias)
npm run test       # vitest run
```

### Komponenten-Regeln

- Komponenten in `src/components/<bereich>/` organisiert
- Seiten in `src/pages/` — pure Komposition aus Komponenten
- API-Calls nur über `src/api/`-Layer — kein direktes `fetch()` in Komponenten
- Zustand via Zustand-Stores in `src/store/` — kein Prop-Drilling über mehr als 2 Ebenen

### Design-Regeln (NOC-Theme)

- Hintergrund: `#0d1117` (dark base)
- Modus-Indikator: Blau = Guardian, Orange = Autopilot, Rot = Kill-Switch
- Keine hellen Themes einbauen — das Projekt ist explizit dark-only
- Glassmorphism-Effekte mit `backdrop-blur` und leicht transparenten Karten

---

## Tests schreiben

### Was braucht Tests?

| Bereich | Pflicht |
|---|---|
| Rust: Öffentliche ozy-core Funktionen | Unit-Tests |
| Rust: Sicherheitskritische Pfade (S4, Write-Gates) | Property-Based Tests |
| Python: API-Endpunkte | Integrationstests |
| Python: Services | Unit-Tests mit gemocktem DB |
| Frontend: Stores | Unit-Tests |
| Frontend: Kritische Komponenten | Component-Tests |

### Was braucht keine Tests?

- Triviale Getter/Setter
- Rein deklarative Konfiguration
- Migrations-SQL (wird durch DB-Sanity-Check in CI abgedeckt)

---

## Pull Request Prozess

1. Branch von `main` erstellen: `git checkout -b feature/<name>`
2. Änderungen implementieren und lokal testen
3. Linter/Formatter ausführen (Rust: `cargo fmt + clippy`, Python: `ruff + mypy`, Frontend: `tsc`)
4. Tests ausführen und sicherstellen, dass alles grün ist
5. PR erstellen mit dem PR-Template ausgefüllt
6. CI muss grün sein (PR Gate): Rust-Tests, Python-Tests, DB-Sanity, Bindings-Smoke, Security-Scan
7. Bei Sicherheitsrelevanz: Explizit im PR beschreiben, welche Sicherheitsgrenzen berührt wurden

**NIEMALS:**
- Fehlende Tests mit `#[allow(...)]` oder `# type: ignore` kaschieren, ohne Kommentar
- CI-Checks deaktivieren
- Direkt auf `main` pushen
- `.env`-Dateien committen
- S3/S4-Test-Daten in den Repository committen

---

## Verbotene Praktiken

Diese Praktiken sind absolut verboten und führen zur Ablehnung des PRs:

| Verboten | Grund |
|---|---|
| `unwrap()` in Produktionscode | Panic in Produktion möglich |
| Direkter LLM-Schreibzugriff auf DB | Bypass der Write-Gate-Pipeline |
| S3/S4-Daten an Cloud-Provider | Privacy-Verletzung, Core-Invariante |
| Echte API-Keys im Code oder Git | Security-Verletzung |
| `AUTH_DEV_BYPASS=true` in Prod | Sicherheitslücke |
| `docker-compose down -v` auf Prod | Löscht alle Postgres-Daten (Claims/Memory) |
| Audit-Log löschen oder überschreiben | Append-Only ist Grundprinzip |
| `user_locked`-Claims per Code überschreiben | Core-Invariante |
