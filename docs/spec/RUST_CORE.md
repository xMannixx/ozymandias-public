# Ozymandias — Rust-Kern Dokumentation

> Crates: `ozy-contracts` · `ozy-core` · `ozy-bindings`  
> Workspace: `rust/`  
> Python-Anbindung: `backend/app/services/rust_bridge.py`

---

## Überblick

Der Rust-Kern ist der **strenge Notar** des Systems. Er führt alle sicherheitskritischen Validierungen synchron, deterministisch und ohne I/O durch.

**Grundregel:** Rust hat keinen DB-Zugriff, keine HTTP-Calls, keine Async-Runtime. Alle benötigten Daten werden von Python übergeben.

```
Python (async)                     Rust (sync, in-process)
      │                                      │
      ├─ Lädt Claims aus DB ──────────────► ozy-core::detect_conflicts()
      ├─ Übergibt TaintContext ───────────► ozy-core::compute_taint()
      ├─ Gibt ClaimData weiter ──────────► ozy-core::validate_schema()
      │                                      │
      │◄─ Erhält G1/G2/G3Result ─────────── └
      │◄─ Erhält TaintDecision ──────────────
      │
      └─ Trifft Orchestrierungsentscheidung
```

---

## ozy-contracts

**Zweck:** Shared-Type-Library. Kein Verhalten, nur Daten.

Alle anderen Crates und Python importieren ihre Typen von hier.

### Enumerationen (`enums.rs`)

#### Sensitivity

```rust
pub enum Sensitivity { S0, S1, S2, S3, S4 }
```

| Wert | Bedeutung | Routing |
|---|---|---|
| `S0` | Öffentlich | Alle Provider |
| `S1` | Intern | Alle Provider, aber nicht öffentlich sharebar |
| `S2` | Vertraulich | Nur verschlüsselte Provider |
| `S3` | Strict (Finanzen, Keys, Verträge) | Nur lokale Modelle |
| `S4` | Intimate | Nur lokal + `intimate_reflection` intent |

Serialisierung: `"S0"`, `"S1"`, `"S2"`, `"S3"`, `"S4"` (exakte Strings)

#### TrustLevel

```rust
pub enum TrustLevel { T0, T1, T2, T3 }
```

| Wert | Bedeutung |
|---|---|
| `T0` | Untrusted (Webseiten, ungeprüfte externe Quellen) |
| `T1` | External verified (geprüfte Quellen) |
| `T2` | System-internal (eigene Connectoren) |
| `T3` | User-confirmed (vom Nutzer bestätigt) |

#### AuthorityLevel

```rust
pub enum AuthorityLevel { A0, A1, A2 }
```

| Wert | Rolle | Befugnisse |
|---|---|---|
| `A0` | Untrusted Source | Nur Daten liefern |
| `A1` | Standard User | Klassen 1–3 bestätigen |
| `A2` | Root/Break-Glass | Klasse 4, Core-Invarianten |

#### ApprovalClass

```rust
pub enum ApprovalClass { Class0, Class1, Class2, Class3, Class4 }
```

| Klasse | Typ | Beispiele |
|---|---|---|
| `Class0` | Read & Ingest | MCP liest Logfile, RAG-Index |
| `Class1` | Reversible Actions | E-Mail-Draft, Termin erstellen |
| `Class2` | Memory & Identity | Fakten bestätigen, Conflicts auflösen |
| `Class3` | Remote Writes | E-Mail senden, GitHub Commit |
| `Class4` | Destructive & Root | Skript-Ausführung, DB-Drops |

Serialisierung: `"class0"` ... `"class4"` (snake_case)

#### HandlingPolicy

```rust
pub enum HandlingPolicy {
    CloudOkEncrypted,   // "cloud_ok_encrypted"
    LocalPreferred,     // "local_preferred"
    LocalOnly,          // "local_only"
    S4Isolated,         // "s4_isolated"
}
```

#### VerificationState

```rust
pub enum VerificationState {
    Tentative,    // "tentative" — unbestätigt
    Confirmed,    // "confirmed" — vom Nutzer bestätigt
    Superseded,   // "superseded" — durch neueren Claim ersetzt
    Retracted,    // "retracted" — vom Nutzer gelöscht
}
```

#### SourceType

```rust
pub enum SourceType {
    UserExplicit,    // "user_explicit" — Nutzer hat explizit gesagt
    ModelInferred,   // "model_inferred" — LLM hat abgeleitet
    ConnectorData,   // "connector_data" — aus Connector importiert
    UserConfirmed,   // "user_confirmed" — Nutzer hat Vorschlag bestätigt
}
```

#### AuditEventType

```rust
pub enum AuditEventType {
    TurnProcessed, MemoryConfirmed, MemoryRejected, MemorySuperseded,
    MemoryRetracted, ActionExecuted, ActionBlocked, ActionRolledBack,
    SensitivityViolation, CircuitBreakerTripped, PayloadSensitivityWarning,
    TaintEscalation, SecurityEvent, ManualOverride,
}
```

#### Weitere Enums

```rust
pub enum Lifecycle      { Session, Temporary, Permanent, Expiry }
pub enum MemoryType     { Profile, Health, Preference, Relationship, Event,
                          Location, Work, Finance, Security, Intimate, Other(String) }
pub enum Channel        { Web, Telegram, System, Celery }
pub enum AuditResult    { Success, Failed, Blocked, RolledBack }
pub enum ConflictResult { NoConflict, TemporalSuccession, ConflictGroup { claim_ids } }
pub enum G1Result       { SchemaValid, SchemaError { errors: Vec<String> } }
pub enum PayloadSensitivityResult { Allowed, Warning { message }, Escalated { new_class } }
pub enum CircuitBreakerDecision { Allow, Trip { reason }, CooldownActive { remaining_seconds } }
pub enum ApprovalDecision { Approved, Denied { reason }, EscalatedTo { new_class } }
pub enum TaintDecision  { Proceed, Escalate { new_class, reason }, Block { reason } }
pub enum DecayActionType { Keep, ReduceConfidence { new_confidence }, Expire, Archive }
```

### Strukturen (`structs.rs`)

#### ClaimData

```rust
pub struct ClaimData {
    pub subject: String,                    // "alex", "kontakt", "auto"
    pub attribute: Option<String>,          // "wohnort", "beruf" — null bei subjektiven Claims
    pub value: String,                      // "Beispielstadt", "softwareentwicklung"
    pub content: String,                    // Menschenlesbare Beschreibung
    pub memory_type: MemoryType,            // profile | health | preference | ...
    pub sensitivity: Sensitivity,           // S0–S4
    pub trust_level: TrustLevel,            // T0–T3
    pub handling_policy: HandlingPolicy,    // cloud_ok_encrypted | ... | s4_isolated
    pub verification_state: VerificationState,
    pub confidence: f64,                    // 0.0–1.0
    pub source_type: SourceType,            // user_explicit | model_inferred | ...
    pub source_ref: Option<String>,         // Turn-ID, Episode-ID, Batch-Job-ID
    pub user_locked: bool,                  // Immun gegen Decay und Überschreibung
    pub decay_eligible: bool,
    pub lifecycle: Lifecycle,               // session | temporary | permanent | expiry
    pub valid_from: Option<String>,         // ISO-8601 UTC
    pub valid_to: Option<String>,           // ISO-8601 UTC
}
```

#### ProposalData

```rust
pub struct ProposalData {
    pub proposed_claim: ClaimData,
    pub source_ref: Option<String>,
    pub source_type: SourceType,
}
```

#### Write-Gate-Typen

```rust
pub struct WriteGateInput { pub proposal: ProposalData }

pub struct G2Result {
    pub auto_confirm_eligible: bool,   // true bei user_explicit/user_confirmed
    pub locked_to_tentative: bool,     // true bei model_inferred/connector_data
}

pub struct G3Result {
    pub result: ConflictResult,
    pub matched_claim_id: Option<String>,  // Bei TemporalSuccession
}
```

#### Taint-Tracking-Typen

```rust
pub struct TaintChunk {
    pub chunk_id: String,
    pub trust_level: TrustLevel,
    pub sensitivity: Sensitivity,
    pub source_type: SourceType,
}

pub struct TaintContext   { pub chunks: Vec<TaintChunk> }

pub struct TaintSummary {
    pub effective_trust: TrustLevel,
    pub effective_sensitivity: Sensitivity,
    pub is_tainted: bool,
    pub taint_sources: Vec<String>,    // chunk_ids die Taint verursacht haben
}

pub struct TaintActionCheck {
    pub taint_summary: TaintSummary,
    pub proposed_class: ApprovalClass,
}
```

#### Infra-Typen

```rust
pub struct CircuitBreakerConfig {
    pub max_actions_per_window: u32,
    pub window_seconds: u64,
    pub cooldown_seconds: u64,
}

pub struct TokenBudgetRequest {
    pub intent_type: String,
    pub available_tokens: u32,
    pub claims_count: u32,
}

pub struct TokenBudgetAllocation {
    pub max_claims: u32,
    pub max_tokens_per_claim: u32,
    pub truncation_needed: bool,
}

pub struct DecayAction {
    pub claim_ref: String,
    pub action: DecayActionType,
}
```

### OzyError (`error.rs`)

```rust
pub enum OzyError {
    SchemaValidation { message: String },
    InvariantViolation { message: String },
    ConflictDetected { message: String },
    ProviderUnavailable { provider: String },
    BudgetExceeded { requested: u32, available: u32 },
    InvalidInput { field: String, reason: String },
}
```

---

## ozy-core

**Zweck:** Reine Logik-Module. Jedes Modul exportiert eine oder zwei Funktionen. Alle Funktionen sind `pub fn`, synchron, ohne I/O.

### write_gates.rs

#### `validate_schema(input: &WriteGateInput) -> Result<G1Result, OzyError>`

G1: Schema-Validierung. Prüft:

| Regel | Fehler |
|---|---|
| `subject` nicht leer | `SchemaError` |
| `value` nicht leer | `SchemaError` |
| `content` nicht leer | `SchemaError` |
| `confidence` ∈ [0.0, 1.0] und endlich | `SchemaError` |
| S4-Claims: `handling_policy == S4Isolated` | `SchemaError` |
| S3-Claims: `handling_policy != CloudOkEncrypted` | `SchemaError` |

Vollständige Validierung (alle Fehler, nicht nur erster).

#### `check_provenance(proposal: &ProposalData) -> Result<G2Result, OzyError>`

G2: Source-Provenance-Check.

```
UserExplicit | UserConfirmed  → auto_confirm_eligible: true,  locked_to_tentative: false
ModelInferred | ConnectorData → auto_confirm_eligible: false, locked_to_tentative: true
```

#### `detect_conflicts(proposal, existing_claims) -> Result<G3Result, OzyError>`

G3: Conflict Detection. Matching auf `subject == existing.subject AND attribute == existing.attribute`.

```
Kein Match      → NoConflict
Match + user_locked  → Err(InvariantViolation)
Match + neueres valid_from → TemporalSuccession
Match sonst     → ConflictGroup { claim_ids }
```

### sensitivity_router.rs

#### `filter_claims(input: &SensitivityFilterInput) -> Result<SensitivityFilterOutput, OzyError>`

Filtert Claims basierend auf Provider-Eigenschaften:

```
S0/S1: immer erlaubt
S2:    erlaubt nur wenn provider_is_encrypted
S3:    erlaubt wenn provider_is_local OR provider_is_encrypted
S4:    erlaubt nur wenn provider_is_local AND intent_type == "intimate_reflection"
```

Gibt `allowed`, `filtered_count` und `filter_reasons` zurück.

#### `check_payload_sensitivity(input: &PayloadSensitivityInput) -> Result<PayloadSensitivityResult, OzyError>`

Prüft ob ein Payload zu sensitiv für eine Aktion auf einem Kanal ist:

```
S0/S1/S2:  Allowed
S3 + non-local channel:  Escalated { new_class: min(Class3, current) }
S4 + Remote Write (Class3+):  Warning
S4 + non-local channel:  Escalated { new_class: min(Class4, current) }
S4 + local:  Allowed
```

### taint_tracker.rs

#### `compute_taint(context: &TaintContext) -> TaintSummary`

Berechnet den effektiven Taint aus allen Chunks:

- `effective_trust` = niedrigster TrustLevel aller Chunks
- `effective_sensitivity` = höchster Sensitivity-Level aller Chunks
- `is_tainted` = true wenn irgendeiner der Chunks T0 hat (Untrusted)
- `taint_sources` = chunk_ids der T0-Chunks

#### `check_tainted_action(input: &TaintActionCheck) -> TaintDecision`

Entscheidet ob eine Aktion bei gegebenem Taint erlaubt ist:

```
is_tainted + proposed_class >= Class2  → Block
is_tainted + proposed_class == Class1  → Escalate { new_class: Class2 }
Sonst                                  → Proceed
```

### decay_engine.rs

#### `evaluate_decay(claim_ref, lifecycle, confidence, valid_to_str, ingested_at_str) -> DecayAction`

Berechnet die Decay-Aktion für einen Claim:

```
user_locked = true                          → Keep
lifecycle == permanent                      → Keep
lifecycle == session                        → Expire
lifecycle == expiry AND valid_to < now      → Expire
lifecycle == temporary:
    confidence * 0.9
    if new_confidence < 0.3  → Archive
    else                     → ReduceConfidence { new_confidence }
```

ISO-8601-Parser ohne externe Dependencies (interner Parser für UTC-Timestamps).

### circuit_breaker.rs

#### `check_circuit_breaker(action_count, config) -> CircuitBreakerDecision`

```
action_count < max_actions_per_window  → Allow
cooldown noch aktiv                    → CooldownActive { remaining_seconds }
sonst                                  → Trip { reason }
```

Konfigurierbar: `max_actions_per_window`, `window_seconds`, `cooldown_seconds`.

### policy_resolver.rs

#### `resolve_approval(request: &ApprovalRequest) -> ApprovalDecision`

Prüft ob eine Aktion mit der gegebenen Authority genehmigt werden kann:

```
Class0  → immer Approved
Class1  → A1+ (Standard-User)
Class2  → A1+ aber immer Guardian (kein Autopilot)
Class3  → A1+ mit Payload-Preview
Class4  → nur A2 (Root/Break-Glass)
```

Eskaliert wenn `payload_sensitivity` zu hoch für `approval_class`.

### token_budget.rs

#### `allocate_token_budget(request: &TokenBudgetRequest) -> TokenBudgetAllocation`

Berechnet Token-Budget nach Intent:

```
available_tokens / claims_count  → max_tokens_per_claim
Intent "work"/"claim_extraction"  → max_claims = min(20, claims_count)
Intent "talk"/"creative"          → max_claims = min(10, claims_count)
Sonst                             → max_claims = min(15, claims_count)
truncation_needed = claims_count > max_claims
```

### audit_validator.rs

#### `validate_audit_entry(entry: &AuditEntry) -> AuditValidationResult`

Strukturelle Prüfung von Audit-Einträgen:

- `actor` darf nicht leer sein
- `target_id` darf nicht leer sein
- `timestamp` muss valides ISO-8601-Format haben
- Bei S3/S4: `detail` darf kein Klartext-PII enthalten (Warning)

---

## ozy-bindings

**Zweck:** PyO3-Bridge — macht alle `ozy-core`-Funktionen aus Python aufrufbar.

### Python-Modul: `ozy_bindings`

```python
import ozy_bindings  # oder Fallback: app.services.ozy_bindings_fallback

# Write-Gates
ozy_bindings.validate_schema(write_gate_input_dict) -> dict | str
ozy_bindings.check_provenance(proposal_dict) -> dict
ozy_bindings.detect_conflicts(proposal_dict, existing_claims_list) -> dict

# Sensitivity-Routing
ozy_bindings.filter_claims(sensitivity_filter_input_dict) -> dict
ozy_bindings.check_payload_sensitivity(payload_sensitivity_input_dict) -> dict | str

# Taint-Tracking
ozy_bindings.compute_taint(taint_context_dict) -> dict
ozy_bindings.check_tainted_action(taint_action_check_dict) -> dict | str

# Governance
ozy_bindings.resolve_approval(approval_request_dict) -> dict | str
ozy_bindings.check_circuit_breaker(action_count, config_dict) -> dict | str
ozy_bindings.allocate_token_budget(request_dict) -> dict

# Audit & Decay
ozy_bindings.validate_audit_entry(audit_entry_dict) -> dict | str
ozy_bindings.evaluate_decay(claim_ref, lifecycle, confidence,
                            valid_to_str, ingested_at_str) -> dict | str
```

### Python-Bridge (`rust_bridge.py`)

`backend/app/services/rust_bridge.py` ist der typsichere Wrapper:

```python
from app.services import rust_bridge

# Vollständig typisiert — übergibt Pydantic-Objekte, erhält Pydantic-Objekte
g1 = rust_bridge.validate_schema(WriteGateInput(proposal=proposal))
g2 = rust_bridge.check_provenance(proposal)
g3 = rust_bridge.detect_conflicts(proposal, existing_claims)
taint = rust_bridge.compute_taint(TaintContext(chunks=[...]))
decision = rust_bridge.check_tainted_action(TaintActionCheck(...))
```

### Fallback-Modus

Fehlt das Modul `ozy_bindings` vollständig, darf die Bridge bei aktiviertem `AUTH_DEV_BYPASS` oder während eines Pytest-Tests `ozy_bindings_fallback.py` laden. Dieser vereinfachte Fallback ersetzt keine Governance-Prüfung. Fehler einer vorhandenen Installation (fehlende Untermodule, inkompatible Python-ABI oder fehlende Shared Libraries) werden weitergereicht; sie aktivieren keinen Fallback.

Im Health-Check:
```json
{ "rust_bindings": "dev-fallback" }  // Fallback aktiv
{ "rust_bindings": "ok" }            // Echte Bindings geladen
```

---

## Bauen und Testen

```bash
cd rust

# Formatierung prüfen
cargo fmt --check

# Linting
cargo clippy --all-targets -- -D warnings

# Alle Tests
cargo test --workspace

# Nur ozy-core Tests
cargo test -p ozy-core

# Nur ozy-contracts Tests (Serialisierung roundtrips)
cargo test -p ozy-contracts

# Release-Build (für Produktion)
cargo build --release --workspace
```

### Test-Coverage

`ozy-contracts` hat vollständige Roundtrip-Tests für alle Enums und Structs (JSON Serialize/Deserialize).

`ozy-core` hat Unit-Tests für alle Kernfunktionen:
- Write-Gates: Schema-Validierung, Provenance, Conflict Detection
- Sensitivity-Router: alle S0–S4 Pfade, alle Provider-Kombinationen
- Taint-Tracker: Taint-Propagierung, Block/Escalate/Proceed
- Circuit-Breaker: Allow, Trip, Cooldown
- Decay-Engine: alle Lifecycle-Typen, Confidence-Berechnung
- Policy-Resolver: alle Approval-Klassen, alle Authority-Level
