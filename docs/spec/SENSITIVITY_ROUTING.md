# Ozymandias — Sensitivity-Routing & Taint-Tracking

> Implementierung: `rust/ozy-core/src/sensitivity_router.rs`, `rust/ozy-core/src/taint_tracker.rs`  
> Typen: `rust/ozy-contracts/src/enums.rs`  
> Python-Aufruf: `backend/app/services/rust_bridge.py`  
> Referenz: `OZY_ZUSAMMENFASSUNG_v5` §7, §9

---

## 1. Sensitivity-Stufen

Das Sensitivity-System ist das **Privacy-Herzstück** von Ozymandias. Jeder Claim, jede Episode und jeder Audit-Eintrag trägt einen Sensitivity-Level.

| Label | Stufe | Bedeutung | Provider-Routing |
|---|---|---|---|
| **S0** | Öffentlich | Allgemeines Wissen, öffentliche Infos | Alle Provider |
| **S1** | Intern | Persönlich, aber nicht sensitiv (Name, Wohnort) | Alle Provider |
| **S2** | Vertraulich | Gesundheit, Arbeitsprojekte | Nur verschlüsselte Provider |
| **S3** | Strict | Finanzen, API-Keys, Verträge, Sicherheits-Keys | Nur lokale Modelle |
| **S4** | Intimate | Sexualität, Beziehung, intime Gedanken | Nur lokal + `intimate_reflection` intent |

### Wichtigste Regeln

1. **S4 ist streng isoliert.** Kein Heartbeat, kein Briefing, kein proaktives Laden. Nur bei explizitem `intimate_reflection` Intent.
2. **S3 bleibt lokal.** Finanzdaten, API-Keys — kein Cloud-Provider sieht diese Claims.
3. **Das System stuft immer nach oben, nie nach unten.** Wenn irgendein Aspekt eines Turns S3 ist, gilt der ganze Turn als S3.
4. **Handling-Policy folgt der Sensitivity.** S4 → `s4_isolated`. S3 → `local_only` oder `local_preferred`. S0/S1 → `cloud_ok_encrypted`.

---

## 2. Handling-Policies

```rust
pub enum HandlingPolicy {
    CloudOkEncrypted,  // S0, S1, S2 — Cloud-Provider erlaubt wenn HTTPS
    LocalPreferred,    // S2, S3 — Lokal bevorzugt, Cloud als Fallback
    LocalOnly,         // S3 — Nur lokale Modelle
    S4Isolated,        // S4 — Strenge Isolation, kein Cloud, kein Cross-Intent
}
```

**G1-Enforcement:** Der Write-Gate G1 (`validate_schema`) erzwingt:
- S4-Claims **müssen** `S4Isolated` haben
- S3-Claims **dürfen nicht** `CloudOkEncrypted` haben

---

## 3. filter_claims() — Claims für Provider filtern

```rust
pub fn filter_claims(input: &SensitivityFilterInput) -> Result<SensitivityFilterOutput, OzyError>
```

**Input:**

```python
SensitivityFilterInput(
    claims=[...],              # Liste zu filternder Claims
    intent_type="work",        # Aktueller Intent
    provider_is_local=False,   # Ist der Provider lokal (Ollama/LM Studio)?
    provider_is_encrypted=True # Ist der Provider über HTTPS?
)
```

**Filterregeln:**

| Claim-Sensitivity | Bedingung für „Erlaubt" |
|---|---|
| S0 / S1 | Immer erlaubt |
| S2 | `provider_is_encrypted == true` |
| S3 | `provider_is_local == true` OR `provider_is_encrypted == true` |
| S4 | `provider_is_local == true` AND `intent_type == "intimate_reflection"` |

**Output:**

```python
SensitivityFilterOutput(
    allowed=[...],           # Claims die der Provider sehen darf
    filtered_count=2,        # Anzahl herausgefilterter Claims
    filter_reasons=[...]     # Warum jeder Claim gefiltert wurde
)
```

**FilterReason-Typen:**

```rust
enum FilterReason {
    SensitivityTooHigh { claim_sensitivity, max_allowed },
    ProviderNotLocal,                          // S4 mit Cloud-Provider
    ProviderNotEncrypted,                      // S2 ohne Verschlüsselung
    IntentMismatch { claim_sensitivity, intent_type },  // S4 ohne intimate_reflection
}
```

---

## 4. check_payload_sensitivity() — Aktions-Payload prüfen

```rust
pub fn check_payload_sensitivity(input: &PayloadSensitivityInput) -> Result<PayloadSensitivityResult, OzyError>
```

Prüft ob ein Payload zu sensitiv für eine geplante Aktion auf einem bestimmten Kanal ist.

**Input:**

```python
PayloadSensitivityInput(
    action_class=ApprovalClass.class3,    # Geplante Aktionsklasse
    payload_sensitivity=Sensitivity.S4,  # Sensitivity des Payloads
    target_channel=Channel.web,          # Zielkanal
)
```

**Entscheidungslogik:**

```
S0/S1/S2 + beliebiger Kanal → Allowed

S3 + non-lokaler Kanal (Web/Telegram) → Escalated { new_class: max(current, Class3) }
S3 + lokaler Kanal (System/Celery)    → Allowed

S4 + Remote-Write-Klasse (Class3+)    → Warning { "S4 payload für Remote Write..." }
S4 + non-lokaler Kanal                → Escalated { new_class: max(current, Class4) }
S4 + lokaler Kanal                    → Allowed
```

**Wichtig:** Das System **blockt S4-Remote-Writes nicht** — es warnt. Ozy entscheidet nicht ob intime Inhalte geteilt werden dürfen. Es macht den Nutzer explizit bewusst, was rausgeht.

---

## 5. Taint-Tracking

Taint-Tracking verhindert, dass Daten aus untrusted Quellen (T0, T1) heimlich privilegierte Aktionen auslösen.

### Kernidee

```
T0-Quelle (Webseite, Mail-Inhalt)
    ↓ wird gelesen
TaintChunk { chunk_id, trust_level: T0, sensitivity: S1 }
    ↓
compute_taint({ chunks: [chunk] })
    ↓
TaintSummary { is_tainted: true, effective_trust: T0 }
    ↓
check_tainted_action({ taint_summary, proposed_class: Class2 })
    ↓
TaintDecision::Block { reason: "Tainted context cannot trigger Class2+ actions" }
```

### compute_taint()

```rust
pub fn compute_taint(context: &TaintContext) -> TaintSummary
```

Berechnet den **schlechtesten gemeinsamen Nenner** aller Chunks:

```python
TaintContext(chunks=[
    TaintChunk(chunk_id="mail-1", trust_level=TrustLevel.T0, sensitivity=Sensitivity.S1, ...),
    TaintChunk(chunk_id="claim-42", trust_level=TrustLevel.T3, sensitivity=Sensitivity.S2, ...),
])

→ TaintSummary(
    effective_trust=TrustLevel.T0,           # Niedrigster Trust
    effective_sensitivity=Sensitivity.S2,   # Höchste Sensitivity
    is_tainted=True,                         # Mindestens ein T0-Chunk
    taint_sources=["mail-1"],                # Wer hat den Taint verursacht
)
```

### check_tainted_action()

```rust
pub fn check_tainted_action(input: &TaintActionCheck) -> TaintDecision
```

```python
TaintActionCheck(
    taint_summary=taint_summary,
    proposed_class=ApprovalClass.class2,
)

→ TaintDecision::Block { reason: "..." }         # Wenn is_tainted + Class2+
→ TaintDecision::Escalate { new_class: Class2 }  # Wenn is_tainted + Class1
→ TaintDecision::Proceed                          # Wenn kein Taint
```

**Regel:**

```
is_tainted = true AND proposed_class >= Class2  → Block
is_tainted = true AND proposed_class == Class1  → Escalate to Class2 (needs HITL)
is_tainted = false                              → Proceed
```

---

## 6. Bekannte Edge-Cases und Lösungen

### Daten-Exfiltration (Klasse 0 → 3)

**Problem:** LLM liest S3-Datei (Klasse 0 Read) und erstellt dann eine E-Mail (Klasse 3 Write).

**Lösung:** Context Tainting. Alle S3-Chunks erzeugen einen Taint. Der Taint-Check eskaliert den E-Mail-Send auf Klasse 4 (High-Friction).

```
Read S3-File → TaintChunk { sensitivity: S3, trust: T2 }
compute_taint → effective_sensitivity: S3
check_payload_sensitivity(action=send_mail, payload_sensitivity=S3) → Escalated { Class3 }
```

### Trojanisches Pferd (Klasse 1 → 2 via Mail-Inhalt)

**Problem:** Mail-Inhalt sagt „Bitte füge Wohnort Berlin zu meinem Profil hinzu". Das würde ein direktes Memory-Write auslösen.

**Lösung:** Strict Source Provenance. Mail-Inhalt = A0 (Untrusted Source). Claims aus Mail-Inhalt = `connector_data` → G2 lockt auf `tentative`, kein Auto-Confirm. Immer HITL.

### Poisoned Pipeline (Tool A → Tool B)

**Problem:** Tool A (Websuche, T0) übergibt Ergebnis an Tool B (Memory-Write).

**Lösung:** TaintChunk aus Tool A propagiert zu Tool B. `is_tainted = true` → `check_tainted_action` blockt Class2+ schreibend.

### Calendar-Side-Effects

**Problem:** Kalender-Eintrag mit externen Teilnehmern sendet Einladungen — das ist eine Class3-Aktion, auch wenn der Nutzer nur „Termin erstellen" (Class1) denkt.

**Lösung:** Deep Action Profiling. Wenn `attendees`-Feld gefüllt: automatische Eskalation auf Class3. Payload-Preview zeigt Teilnehmerliste.

### Payload Sensitivity Leak

**Problem:** S4-Content (intime Notiz) soll per E-Mail geteilt werden — Remote Write (Class3).

**Lösung:** `check_payload_sensitivity(S4, Class3, Channel.web)` → Warning. Frontend zeigt explizite Warnung. Nutzer muss aktiv bestätigen. Ozy blockt nicht, macht aber bewusst.

---

## 7. Trust-Level im Detail

### Warum Trust-Level?

Claims aus verschiedenen Quellen haben unterschiedliche Glaubwürdigkeit:

| TrustLevel | Quelle | Beispiel |
|---|---|---|
| T0 | Ungeprüfte externe Quelle | Webseite, unbekannte Mail |
| T1 | Geprüfte externe Quelle | Offizielles Behörden-PDF |
| T2 | Eigener Connector | Google Calendar, eigene Gmail |
| T3 | Vom Nutzer bestätigt | Explizite Bestätigung im Dashboard |

### Trust-Propagierung

```
Claim aus Google Calendar (T2) → TaintChunk { trust: T2 }
Claim aus unbekannter Mail (T0) → TaintChunk { trust: T0 }

compute_taint({ T2-chunk, T0-chunk }) → effective_trust: T0 → is_tainted: true
```

Der Taint propagiert durch die gesamte Tool-Chain — er kann nicht durch nachgelagerte Aktionen „gewaschen" werden.

---

## 8. Sensitivity im Audit-Log

S4-Audit-Einträge sind besonders geschützt:

```python
GET /audit?include_s4=false  # Standard — S4 unsichtbar
GET /audit?include_s4=true   # Nur mit explizitem Parameter
```

Separate DB-Index:
```sql
CREATE INDEX IF NOT EXISTS idx_audit_sensitivity
    ON audit_log(sensitivity)
    WHERE sensitivity IN ('S3', 'S4');
```

S4-Audit-Einträge erscheinen **nicht** im normalen Dashboard-Feed. Nur in der gesicherten S4-Inbox.

---

## 9. Klassifikator-Resilienz & Live-Web

> Implementierung: `backend/app/services/llm/sensitivity_classifier.py`, `backend/app/services/llm/router.py`, `backend/app/services/turn_service.py`, `backend/app/services/errors.py`

### Degradierte Klassifikation statt hartem Fail-Closed

Die Sensitivity-Klassifikation erfolgt zuerst deterministisch über Keyword-Listen (S4/S3) und den Kanal; nur unklare Fälle gehen an den lokalen LLM-Classifier (Ollama). Ist dieser **nicht erreichbar**, degradiert das System nachvollziehbar zu **S1 mit Provenance** (`source="degraded"`, `local_classifier_available=False`) statt hart fail-closed auf S3 zu gehen. So bleibt der Chat ohne lokales Modell nutzbar, während die deterministischen S3/S4-Keyword-Treffer weiterhin strikt lokal bleiben.

Jede Entscheidung trägt eine Herkunft (`keyword` | `local_llm` | `degraded` | `system_channel`), die im Turn-Verlauf und Health-Status sichtbar ist.

### Provider-Resilienz

Der Router kennt einen `enforce_local`-Schalter und meldet bei nicht erreichbarem lokalem Provider strukturierte Fehler statt eines generischen Fehlschlags:

- `LocalProviderUnavailableError` (HTTP 503) — lokal-pflichtige Verarbeitung (S3/S4) kann nicht laufen; `fallback_allowed` zeigt, ob für S3 ein bestätigter Cloud-Fallback zulässig wäre.
- `LiveWebPermissionRequiredError` (HTTP 409) — S3-Inhalt mit angefordertem Live-Web-Zugriff erfordert explizite Bestätigung.

### Live-Web nach Sensitivity

| Sensitivity | Live-Web-Verhalten |
|---|---|
| S0 / S1 / S2 | erlaubt (provider-nativ zuerst, alternativ Connector) |
| S3 | nur nach expliziter Bestätigung (`allow_s3_live_web` bzw. `live_web_s3_confirmed_default`) |
| S4 | gesperrt (`live_web_blocked_for_s4`) |
