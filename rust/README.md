# Ozymandias — Rust-Workspace

Der Rust-Kern von Ozymandias. Synchrone Validierung, Governance, Sensitivity-Routing, Memory-Write-Gates und Security-Invarianten. **Kein I/O, keine Datenbank, kein Async** — reiner Wächter.

---

## Überblick

Der Rust-Workspace besteht aus drei Crates mit klarer Hierarchie:

```
ozy-contracts  →  ozy-core  →  ozy-bindings  →  Python (via PyO3)
   (Typen)       (Logik)      (Exposition)
```

**Warum Rust?** Rust erzwingt korrekte Fehlerbehandlung zur Kompilierzeit, hat keine GIL, und macht sicherheitskritische Invarianten explizit und auditierbar. Der Python-Stack orchestriert — der Rust-Stack wacht.

---

## Schnellstart

```bash
cd rust

# Workspace bauen
cargo build --workspace

# Tests ausführen
cargo test --workspace

# Format prüfen
cargo fmt --check

# Linter
cargo clippy --all-targets -- -D warnings

# Dokumentation generieren
cargo doc --workspace --open
```

---

## Crate-Übersicht

### `ozy-contracts` — Typen & Datenstrukturen

**Zweck:** Alle geteilten Typen, Enums und Error-Types. Kein Verhalten, keine Logik, keine I/O.

**Enthält:**
- Security/Trust-Enums: `Sensitivity` (S0–S4), `TrustLevel` (T0–T3), `AuthorityLevel` (A0–A2), `HandlingPolicy`
- Memory-Enums: `VerificationState`, `Lifecycle`, `SourceType`, `MemoryType`, `ProposalStatus`, `ConflictGroupStatus`, `ChangedBy`
- Governance-Enums: `ApprovalClass` (0–4), `ConflictResult`, `AuditEventType`, `AuditResult`
- Infrastruktur-Enums: `Channel`, `Role`, `RuleCategory`, `FilterReason`
- Memory-Structs: `ClaimData`, `ProposalData`, `ConflictGroupData`
- Write-Gate-I/O: `WriteGateInput`, `G1Result`, `G2Result`, `G3Result`
- Sensitivity-I/O: `SensitivityFilterInput/Output`, `PayloadSensitivityInput/Result`
- Governance-I/O: `ApprovalRequest/Decision`
- Audit-Struct: `AuditEntry`
- Circuit Breaker: `CircuitBreakerConfig`, `CircuitBreakerStatus`
- Token Budget: `TokenBudgetRequest`, `TokenBudgetAllocation`
- Decay: `DecayAction`, `DecayActionType`
- Error-Typ: `OzyError`

**Regeln:**
- Alle Typen: `Serialize`, `Deserialize`, `Clone`, `Debug`
- Keine `chrono`-Timestamps — Timestamps sind `String` (ISO 8601)
- Keine UUID-Types — UUIDs sind `String`
- Keine Logik, kein Async, kein I/O
- Keine `#[pyclass]`-Attribute — die gehören in `ozy-bindings`

Vollständige Typen-Referenz: [`docs/OZY_CONTRACTS_SPEC_v1_2026-04-03.md`](../docs/OZY_CONTRACTS_SPEC_v1_2026-04-03.md)

### `ozy-core` — Validierungslogik

**Zweck:** Synchrone Validierungslogik, die alle Sicherheitsinvarianten durchsetzt.

**Module:**

| Modul | Datei | Funktion |
|---|---|---|
| Write-Gates | `write_gates.rs` | G1 Schema, G2 Provenance, G3 Conflict Detection |
| Sensitivity Router | `sensitivity_router.rs` | `filter_claims()`, `check_payload_sensitivity()` |
| Decay Engine | `decay_engine.rs` | `evaluate_decay()` — Memory-Garbage-Collection |
| Circuit Breaker | `circuit_breaker.rs` | Rate-Limiting-Entscheidungen |
| Policy Resolver | `policy_resolver.rs` | Approval-Klassen-Einstufung |
| Token Budget | `token_budget.rs` | Context-Assembly-Budgetierung |
| Taint Tracker | `taint_tracker.rs` | Untrusted-Tag-Propagierung |
| Audit Validator | `audit_validator.rs` | AuditEntry-Validierung |

**Regeln:**
- Nur synchron — kein `async`, kein `await`
- Kein I/O — keine Dateisystem-, Netzwerk-, DB-Zugriffe
- Alle öffentlichen Funktionen haben rustdoc-Kommentare
- Alle öffentlichen Funktionen haben Unit-Tests in `tests/`

### `ozy-bindings` — Python-Exposition (PyO3)

**Zweck:** Dünner PyO3-Wrapper, der ozy-core-Funktionen nach Python exponiert.

**Regeln:**
- Keine eigene Logik — nur Delegation an `ozy-core`
- Python-kompatible Typen (String-Serialisierung via `serde_json`)
- Alle exponierten Funktionen haben Smoke-Tests in `tests/`

**Exponierte Funktionen (Python-aufrufbar):**
- `validate_schema(input)` → G1 Write-Gate
- `check_provenance(proposal)` → G2 Write-Gate
- `detect_conflicts(proposal, existing_claims)` → G3 Write-Gate
- `filter_claims(input)` → Sensitivity Router
- `check_payload_sensitivity(input)` → Payload-Check
- `evaluate_decay(claims, now_iso)` → Decay Engine
- `check_circuit_breaker(config, count, status, reason)` → Circuit Breaker
- `validate_audit_entry(entry)` → Audit Validator

---

## Sicherheitsinvarianten (unveränderlich)

Diese Invarianten sind in Rust implementiert und dürfen **niemals** durch Python-Code umgangen werden:

| Invariante | Implementierung |
|---|---|
| S4-Claims brauchen `handling_policy = S4Isolated` | `write_gates::validate_schema()` |
| S3-Claims dürfen nicht `CloudOkEncrypted` sein | `write_gates::validate_schema()` |
| `user_locked`-Claims können nicht überschrieben werden | `write_gates::detect_conflicts()` |
| S4-Claims gehen nur an lokale Provider | `sensitivity_router::filter_claims()` |
| S4 erfordert `intent_type == "intimate_reflection"` | `sensitivity_router::filter_claims()` |
| S4-Payload + Remote Write → explizite Warnung | `sensitivity_router::check_payload_sensitivity()` |
| Circuit Breaker kann Aktionen blockieren | `circuit_breaker::check()` |

---

## Tests ausführen

```bash
cd rust

# Alle Tests (Unit + Integration)
cargo test --workspace

# Verbose Output
cargo test --workspace -- --nocapture

# Nur ein Crate
cargo test -p ozy-core
cargo test -p ozy-contracts
cargo test -p ozy-bindings

# Einen spezifischen Test
cargo test -p ozy-core write_gates::tests::test_s4_requires_s4_isolated
```

### Test-Konventionen

- Unit-Tests: In `#[cfg(test)]`-Modul am Ende jeder `.rs`-Datei
- Integrations-Tests: In `crate/tests/`-Verzeichnis
- Property-Based Tests: `proptest` für sicherheitskritische Funktionen
- Jede öffentliche Funktion in `ozy-core` hat mindestens einen Test

---

## Abhängigkeiten

```toml
# Workspace-Abhängigkeiten (rust/Cargo.toml)
serde        = { version = "1", features = ["derive"] }
serde_json   = "1"
proptest     = "1"  # Nur in dev-dependencies

# ozy-bindings zusätzlich
pyo3         = { version = "0.x", features = ["extension-module"] }
```

**Keine `chrono`-Abhängigkeit in `ozy-contracts` oder `ozy-core`** — Timestamps werden als ISO-8601-Strings verarbeitet. Der Decay Engine enthält einen eigenen ISO-8601-Parser ohne externe Abhängigkeiten (`decay_engine.rs::parse_iso8601_to_utc_key()`).

---

## Python-Integration

Die Rust-Bindings werden als Python-Extension-Modul (`.so` / `.pyd`) gebaut und von Python importiert:

```python
# backend/app/services/rust_bridge.py
import ozy_bindings  # Rust-Extension-Modul

result = ozy_bindings.validate_schema(gate_input)
```

**Fallback-Modus:** Wenn `AUTH_DEV_BYPASS=true` und `ozy_bindings` nicht installiert ist, wird `ozy_bindings_fallback.py` verwendet. Dieser Fallback gibt immer `"Valid"`/`"Allow"` zurück — **nur für lokale Entwicklung ohne Rust-Build**.

### Rust für Python bauen

```bash
# maturin installieren (PyO3 build tool)
pip install maturin

# Bindings bauen und in aktives Python-Environment installieren
cd rust/ozy-bindings
maturin develop

# Für Produktion (Wheel bauen)
maturin build --release
```

---

## Edition und Toolchain

- **Rust Edition:** 2024 (alle Crates)
- **MSRV:** 1.94+ (Minimum Supported Rust Version)
- **Stable Toolchain** — kein Nightly required

```bash
# Toolchain prüfen
rustc --version   # >= 1.94
cargo --version   # >= 1.94
```
