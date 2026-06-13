# OZY Write-Gates — Technische Spezifikation

> Implementiert in: `rust/ozy-core/src/write_gates.rs`  
> Typen in: `rust/ozy-contracts/src/lib.rs`  
> Python-Anbindung: `rust/ozy-bindings/src/lib.rs` → `backend/app/services/rust_bridge.py`  
> Referenz: `OZY_ZUSAMMENFASSUNG_v5` §6.3, `OZY_CONTRACTS_SPEC_v1`

---

## Überblick

Die **5 Write-Gates** sind das sicherheitskritischste Konzept im Ozymandias-System. Sie gewährleisten, dass **kein LLM direkt in die Datenbank schreiben kann**. Jeder Memory-Schreibvorgang muss die gesamte Pipeline sequenziell durchlaufen.

**Kernprinzip:** Fail-closed — jede Gate-Prüfung, die fehlschlägt, stoppt den gesamten Schreibprozess. Es gibt keinen Weg, ein Gate zu überspringen.

```
LLM-Output
    ↓
[G1: Schema-Validierung]     ← Pydantic + Rust
    ↓
[G2: Source Provenance]      ← Rust
    ↓
[G3: Conflict Detection]     ← Rust
    ↓
[G4: Human-in-the-Loop]      ← Dashboard-Inbox (Proposal-Workflow)
    ↓
[G5: Append-Only Commit]     ← PostgreSQL + Versionierung
    ↓
Claim in DB (verifiziert)
```

---

## G1: Schema-Validierung

**Zweck:** Sicherstellen, dass das vorgeschlagene Claim-Objekt alle Pflichtfelder enthält und konsistent ist.

**Implementierung:** `rust/ozy-core/src/write_gates.rs::validate_schema()`

### Geprüfte Invarianten

| Regel | Fehler bei Verletzung |
|---|---|
| `subject` darf nicht leer sein | `SchemaError` |
| `value` darf nicht leer sein | `SchemaError` |
| `content` darf nicht leer sein | `SchemaError` |
| `confidence` muss im Bereich `[0.0, 1.0]` sein und endlich | `SchemaError` |
| S4-Claims **müssen** `handling_policy = S4Isolated` haben | `SchemaError` |
| S3-Claims dürfen **nicht** `handling_policy = CloudOkEncrypted` verwenden | `SchemaError` |

### Rückgabetypen

```rust
pub enum G1Result {
    SchemaValid,
    SchemaError { errors: Vec<String> },
}
```

### Verhalten bei Fehler

Bei `SchemaError` wird das Proposal **abgelehnt** und ein `AuditEventType::ActionBlocked`-Eintrag erzeugt. Die Fehler-Liste enthält alle verletzten Regeln (nicht nur den ersten Fehler — vollständige Validierung).

---

## G2: Source Provenance

**Zweck:** Kontrollieren, ob ein Claim automatisch bestätigt werden kann oder zwingend in der Proposal-Inbox bleibt.

**Implementierung:** `rust/ozy-core/src/write_gates.rs::check_provenance()`

### Logik

```
SourceType::UserExplicit    → auto_confirm_eligible: true,  locked_to_tentative: false
SourceType::UserConfirmed   → auto_confirm_eligible: true,  locked_to_tentative: false
SourceType::ModelInferred   → auto_confirm_eligible: false, locked_to_tentative: true
SourceType::ConnectorData   → auto_confirm_eligible: false, locked_to_tentative: true
```

**Kritische Regel:** `ModelInferred`- und `ConnectorData`-Claims sind **hart auf `tentative` gelockt**. Selbst wenn das LLM mit hoher Konfidenz einen Fakt behauptet, bleibt er tentativ bis zur menschlichen Bestätigung.

**Auto-Confirm:** `UserExplicit`-Claims können automatisch bestätigt werden (z.B. wenn der Nutzer explizit sagt „Merk dir: Ich wohne in Berlin"). Das Proposal wird erstellt, aber sofort in den `auto_confirmed`-Status gesetzt.

### Rückgabetyp

```rust
pub struct G2Result {
    pub auto_confirm_eligible: bool,
    pub locked_to_tentative: bool,
}
```

---

## G3: Conflict Detection

**Zweck:** Prüfen, ob das neue Proposal mit bestehenden Claims in der Datenbank in Konflikt steht.

**Implementierung:** `rust/ozy-core/src/write_gates.rs::detect_conflicts()`

### Matching-Logik

Zwei Claims „matchen" wenn:
```
proposed.subject == existing.subject AND proposed.attribute == existing.attribute
```

(Nur aktive Claims werden geprüft — `superseded` und `retracted` werden ignoriert, das passiert auf DB-Ebene via Index `idx_claims_subject_attribute`.)

### Drei mögliche Ergebnisse

#### 1. `NoConflict`
Kein bestehender Claim mit gleichem Subject+Attribute gefunden. Proposal kann direkt in G4.

#### 2. `TemporalSuccession`
Ein bestehender Claim hat das gleiche Subject+Attribute, aber das neue Proposal hat ein neueres `valid_from`-Datum. Der alte Claim wird als `superseded` markiert, der neue Claim tritt an seine Stelle.

**Logik:**
```
if proposed.valid_from > existing.valid_from  →  TemporalSuccession
```
(ISO-8601-String-Vergleich, UTC-normalisiert)

#### 3. `ConflictGroup { claim_ids: Vec<String> }`
Echter Widerspruch — kein zeitlicher Nachfolger erkennbar. Alle betroffenen Claims werden in einer `ConflictGroup` zusammengefasst, die in der Dashboard-Inbox erscheint. **Der Nutzer entscheidet.**

### Invariante: User-Locked Claims

Wenn ein gematchter bestehender Claim `user_locked = true` hat, wird **kein** Proposal erstellt. Das System wirft einen `OzyError::InvariantViolation` mit der Meldung `"locked claim cannot be overridden"`. Locked Claims sind absolut unveränderlich.

### Rückgabetyp

```rust
pub struct G3Result {
    pub result: ConflictResult,
    pub matched_claim_id: Option<String>,  // Bei TemporalSuccession: welcher Claim ersetzt wird
}

pub enum ConflictResult {
    NoConflict,
    TemporalSuccession,
    ConflictGroup { claim_ids: Vec<String> },
}
```

---

## G4: Human-in-the-Loop (Proposal-Inbox)

**Zweck:** Menschliche Kontrolle über alle Memory-Schreibvorgänge, die nicht auto-bestätigt werden können.

**Implementierung:** Python — `backend/app/services/proposal_service.py`, `backend/app/api/proposals.py`

### Proposal-Status-Maschine

```
pending → confirmed    (Nutzer bestätigt, Claim wird erstellt)
pending → rejected     (Nutzer lehnt ab, kein Claim)
pending → auto_confirmed  (G2: UserExplicit ohne Unsicherheitsmarker)
```

### Proposal-Objekt (DB-Tabelle `memory_proposals`)

| Feld | Typ | Beschreibung |
|---|---|---|
| `proposal_id` | UUID | Eindeutige ID |
| `user_id` | UUID | Besitzer |
| `proposed_claim` | JSONB | Vollständiger ClaimData-Snapshot |
| `source_ref` | TEXT | Turn-ID, Episode-ID, Batch-Job-ID |
| `source_type` | TEXT | `user_explicit` \| `model_inferred` \| `connector_data` |
| `status` | TEXT | `pending` \| `confirmed` \| `rejected` \| `auto_confirmed` |
| `conflict_group_id` | UUID? | Verknüpfung zur ConflictGroup falls G3 einen Widerspruch fand |
| `rejection_reason` | TEXT? | Freitext-Begründung bei Ablehnung |
| `decided_at` | TIMESTAMPTZ? | Zeitpunkt der Entscheidung |
| `decided_by` | TEXT? | `user` \| `auto_confirm` \| `batch` |

### Dashboard-Verhalten

- Offene Proposals erscheinen in der **Memory-Inbox** im Dashboard
- Der Nutzer kann jeden Proposal **bestätigen**, **ablehnen** (mit optionaler Begründung) oder **editieren** (Wert korrigieren vor Bestätigung)
- ConflictGroups werden als zusammengehörige Gruppe angezeigt
- S4-Proposals erscheinen nur in der S4-gesicherten Inbox (gestufte Sichtbarkeit)

---

## G5: Append-Only Commit

**Zweck:** Sicherstellen, dass jede Claim-Änderung versioniert und unveränderlich protokolliert wird.

**Implementierung:** Python — `backend/app/services/claim_service.py`

### Versionierungs-Mechanismus

Bei jeder Änderung an einem Claim wird ein neuer Eintrag in `claim_versions` erzeugt:

```python
# Jede Claim-Änderung erzeugt eine neue Version
version = ClaimVersion(
    claim_id=claim.claim_id,
    version_number=next_version,
    version_hash=sha256(content_snapshot),
    previous_hash=last_version.version_hash,  # Hash-Chain
    content_snapshot=claim.as_dict(),
    change_reason=reason,
    changed_by=changed_by,  # "user" | "system" | "decay_job" | "batch_extract"
)
```

### Hash-Chain-Integrität

- `version_hash` ist SHA-256 über den vollständigen `content_snapshot`
- `previous_hash` zeigt auf den Hash der Vorgänger-Version (erste Version: `NULL`)
- Jede Manipulation einer Version (Nachträgliches Ändern) ist erkennbar, da die Hash-Chain bricht

### Zustandsübergänge

| Von | Nach | Trigger |
|---|---|---|
| `tentative` | `confirmed` | Nutzer bestätigt Proposal |
| `confirmed` | `superseded` | G3 TemporalSuccession |
| `*` | `retracted` | Nutzer löscht Claim ("Vergiss das") |
| `*` | `archived` | Decay: Confidence < Threshold |

**Wichtig:** Retracted und archived Claims werden **nicht physisch gelöscht** — sie bleiben in der DB und sind über `claim_versions` nachvollziehbar. Nur `review_due` und Decay-Jobs können archivierte Claims später physisch löschen (nach Retention-Policy).

---

## Zusammenspiel im Turn-Service

```python
# backend/app/services/turn_service.py (vereinfacht)

# G1: Schema-Validierung
g1_result = rust_bridge.validate_schema(WriteGateInput(proposal=proposal_data))
if isinstance(g1_result, G1SchemaError):
    raise ServiceError(f"Schema invalid: {g1_result.errors}")

# G2: Source Provenance
g2_result = rust_bridge.check_provenance(proposal_data)
if g2_result.locked_to_tentative:
    claim_data.verification_state = VerificationState.Tentative

# G3: Conflict Detection (benötigt bestehende Claims aus DB)
existing_claims = await claim_service.get_claims_for_subject(subject, user_id)
g3_result = rust_bridge.detect_conflicts(proposal_data, existing_claims)

if isinstance(g3_result.result, ConflictGroup):
    await proposal_service.create_proposal(conflict_group_id=group_id, ...)
elif g3_result.result == ConflictResult.TemporalSuccession:
    await claim_service.supersede_claim(g3_result.matched_claim_id)

# G4: Proposal erstellen (Human-in-the-Loop)
proposal = await proposal_service.create_proposal(user_id=user_id, proposal=proposal_data)

# G4b: Auto-Confirm falls berechtigt
if g2_result.auto_confirm_eligible and not has_uncertainty_marker(turn_text):
    await proposal_service.approve_proposal(proposal.proposal_id, decided_by="auto_confirm")

# G5: Append-Only Commit (intern in approve_proposal → create_claim_from_proposal)
```

---

## Fehlerbehandlung

| Fehler | Typ | Bedeutung |
|---|---|---|
| `OzyError::SchemaValidation` | G1 | Pflichtfelder fehlen oder Constraints verletzt |
| `OzyError::InvariantViolation` | G3 | Versuch, locked Claim zu überschreiben |
| `OzyError::ConflictDetected` | G3 | ConflictGroup erzeugt, Nutzer muss entscheiden |
| `ConflictError` (Python) | G4 | Proposal ist nicht mehr pending |
| `NotFoundError` (Python) | G4 | Proposal-ID ungültig |

Alle Fehler werden ins Audit-Log geschrieben (`AuditEventType::ActionBlocked` oder `AuditEventType::MemoryRejected`).
