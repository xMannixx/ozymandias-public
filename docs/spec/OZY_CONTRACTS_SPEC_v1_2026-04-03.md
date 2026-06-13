# ozy-contracts — Typen-Spec
# Stand: 03.04.2026, Session 4

> Dieses Dokument definiert alle Typen, Enums und Error-Types für das Rust-Crate `ozy-contracts`.
> Kein Verhalten, keine Logik, keine I/O. Nur Datenstrukturen.
> Alle Typen: Serde Serialize/Deserialize, PyO3-kompatibel (String statt &str).
> Referenz: OZY_ZUSAMMENFASSUNG_v5, OZY_DB_Schema.sql, Checkpoints S1–S3.

---

## Enums

### Security & Trust

**Sensitivity**
- S0 — Öffentlich. Alle Provider.
- S1 — Intern. Alle Provider, nicht öffentlich.
- S2 — Vertraulich. Nur vertrauenswürdige Provider.
- S3 — Strict/Ops (Finanzen, Keys, Verträge). Lokal bevorzugt, verschlüsselt auf Cloud OK.
- S4 — Intimate (Sexualität, Beziehung). Nur lokal, isoliert, guardrail-freies Modell. Cloud-Provider blocken den Content.

**TrustLevel**
- T0 — Untrusted (Webseiten, ungeprüfte externe Quellen)
- T1 — External verified (geprüfte Quellen)
- T2 — System-internal (eigene Connectoren)
- T3 — User-confirmed (vom Nutzer bestätigt)

**AuthorityLevel**
- A0 — Untrusted Source (Connectoren, Mails, RAG). Nur Daten liefern, nie Aktionen absegnen.
- A1 — Standard User (Telegram, Web-UI mit JWT). Klasse 1–3 bestätigen.
- A2 — Root/Break-Glass (lokale Console / Hardware-Token). Klasse 4, S3-Daten, Core-Invarianten.

**HandlingPolicy**
- CloudOkEncrypted — Verschlüsselt auf Cloud erlaubt.
- LocalPreferred — Lokal bevorzugt, Cloud als Fallback.
- LocalOnly — Nur lokal, kein Cloud.
- S4Isolated — Lokal + isoliert + guardrail-freies Modell.

### Memory

**VerificationState**
- Tentative — Unbestätigt, schneller Decay (14 Tage HWZ).
- Confirmed — Bestätigt, langsamer Decay (2 Jahre HWZ).
- Superseded — Durch neuen Claim ersetzt.
- Retracted — Vom Nutzer gelöscht ("Vergiss das").

**Lifecycle**
- Session — Gilt nur für aktuelle Session.
- Temporary — Zeitlich begrenzt.
- Permanent — Unbegrenzt gültig.
- Expiry — Hat ein festes Ablaufdatum (valid_to).

**SourceType**
- UserExplicit — Nutzer hat es direkt gesagt ("Merk dir X").
- ModelInferred — Modell hat es abgeleitet.
- ConnectorData — Aus externem System importiert.
- UserConfirmed — Nutzer hat Proposal bestätigt.

**MemoryType**
- Profile, Health, Preference, Relationship, Event, Location, Work, Finance, Security, Intimate
- Erweiterbar. MemoryType ist unabhängig von Sensitivity — ein Relationship-Claim kann S0 oder S4 sein.

**ProposalStatus**
- Pending — Wartet auf Entscheidung.
- Confirmed — Bestätigt, Claim erstellt.
- Rejected — Abgelehnt.
- AutoConfirmed — Automatisch bestätigt (user_explicit ohne Unsicherheitsmarker).

**ConflictGroupStatus**
- Pending — Offen, Nutzer muss entscheiden.
- Resolved — Aufgelöst.

**ChangedBy**
- User — Nutzer hat geändert.
- System — Systemänderung.
- DecayJob — Decay-Hintergrundjob.
- BatchExtract — Batch-Extraktionsjob.

### Governance

**ApprovalClass**
- Class0 — Read & Ingest. Keine Freigabe nötig.
- Class1 — Reversible Actions. Autopilot mit Undo-Window.
- Class2 — Memory & Identity. Immer Guardian, kein Autopilot.
- Class3 — Remote Writes. Hard Confirm mit Payload-Vorschau.
- Class4 — Destructive & Root. High-Friction (CONFIRM oder Re-Auth).

**ConflictResult**
- NoConflict — Kein Widerspruch gefunden.
- TemporalSuccession — Zeitlicher Wechsel, alter Claim wird superseded.
- ConflictGroup { claim_ids: Vec<String> } — Echter Widerspruch, Nutzer entscheidet.

### Audit

**AuditEventType**
- TurnProcessed
- MemoryConfirmed
- MemoryRejected
- MemorySuperseded
- MemoryRetracted
- ActionExecuted
- ActionBlocked
- ActionRolledBack
- SensitivityViolation
- CircuitBreakerTripped
- PayloadSensitivityWarning
- TaintEscalation

**AuditResult**
- Success
- Failed
- Blocked
- RolledBack

### Infrastruktur

**Channel**
- Web
- Telegram
- System
- Celery

**Role**
- User
- Assistant
- System

**RuleCategory**
- Tone
- MailBehavior
- WorkStyle
- Formatting
- Security

**FilterReason**
- SensitivityTooHigh { claim_sensitivity: Sensitivity, max_allowed: Sensitivity }
- ProviderNotLocal
- ProviderNotEncrypted
- IntentMismatch { claim_sensitivity: Sensitivity, intent_type: String }

---

## Structs

### Memory-Pipeline

**ClaimData**
- subject: String — Wer/Was ("alex", "kontakt", "auto")
- attribute: Option<String> — Welche Eigenschaft ("wohnort", "beruf"). None bei subjektiven Claims.
- value: String — Der Wert ("beispielstadt", "softwareentwicklung")
- content: String — Menschenlesbare Beschreibung
- memory_type: MemoryType
- sensitivity: Sensitivity
- trust_level: TrustLevel
- handling_policy: HandlingPolicy
- verification_state: VerificationState
- confidence: f64
- source_type: SourceType
- source_ref: Option<String> — Episode-ID, Turn-ID, Batch-Job-ID
- user_locked: bool
- decay_eligible: bool
- lifecycle: Lifecycle
- valid_from: Option<String> — ISO 8601 Timestamp
- valid_to: Option<String> — ISO 8601 Timestamp

**ProposalData**
- proposed_claim: ClaimData
- source_ref: Option<String>
- source_type: SourceType

**ConflictGroupData**
- group_id: String
- claim_ids: Vec<String> — Kann mehr als zwei Claims enthalten
- status: ConflictGroupStatus

### Write-Gate I/O

**WriteGateInput**
- proposal: ProposalData

**G1Result** (Schema-Validierung)
- SchemaValid
- SchemaError { errors: Vec<String> }

**G2Result** (Source Provenance)
- auto_confirm_eligible: bool
- locked_to_tentative: bool

**G3Result** (Conflict Detection)
- result: ConflictResult
- matched_claim_id: Option<String> — Bei TemporalSuccession: welcher Claim superseded wird

### Sensitivity Router

**SensitivityFilterInput**
- claims: Vec<ClaimData>
- intent_type: String
- provider_is_local: bool
- provider_is_encrypted: bool

**SensitivityFilterOutput**
- allowed: Vec<ClaimData>
- filtered_count: u32
- filter_reasons: Vec<FilterReason>

### Payload-Sensitivity-Check

**PayloadSensitivityInput**
- action_class: ApprovalClass
- payload_sensitivity: Sensitivity
- target_channel: Channel

**PayloadSensitivityResult**
- Allowed
- Warning { message: String } — Ozy warnt, blockt nicht. "Du verschickst gerade S4-Content per E-Mail."
- Escalated { new_class: ApprovalClass }

### Approval

**ApprovalRequest**
- action_type: String
- approval_class: ApprovalClass
- payload_preview: Option<String>
- authority_level: AuthorityLevel
- payload_sensitivity: Option<Sensitivity>

**ApprovalDecision**
- Approved
- Denied { reason: String }
- EscalatedTo { new_class: ApprovalClass }

### Audit

**AuditEntry**
- event_type: AuditEventType
- channel: Channel
- payload: Option<String> — JSON-String
- source_ref: Option<String>
- result: AuditResult
- sensitivity: Sensitivity

### Circuit Breaker

**CircuitBreakerConfig**
- max_actions_per_window: u32
- window_seconds: u64
- cooldown_seconds: u64

**CircuitBreakerStatus**
- Open
- Closed
- Tripped { reason: String }

### Token Budget

**TokenBudgetRequest**
- intent_type: String
- available_tokens: u32
- claims_count: u32

**TokenBudgetAllocation**
- max_claims: u32
- max_tokens_per_claim: u32
- truncation_needed: bool

---

## Error-Typ

**OzyError**
- SchemaValidation { message: String }
- SensitivityViolation { message: String }
- ApprovalDenied { message: String }
- ConflictDetected { group: ConflictGroupData }
- CircuitBreakerTripped { message: String }
- TokenBudgetExceeded
- TaintPropagation { message: String }
- InvariantViolation { message: String }
- PayloadSensitivityLeak { message: String }

---

## Was NICHT in ozy-contracts gehört

- Keine DB-Typen (SQLAlchemy-Models = Python)
- Keine Timestamps als Chrono-Types (Python generiert, Rust bekommt String)
- Keine UUIDs als Uuid-Type (Python generiert, Rust bekommt String)
- Kein Async, kein I/O, keine Netzwerk-Aufrufe
- Keine Validierungs-Logik (die gehört in ozy-core)
- Keine PyO3-Attribute (#[pyclass] etc.) — die gehören in ozy-bindings
