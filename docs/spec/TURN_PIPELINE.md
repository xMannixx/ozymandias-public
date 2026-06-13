# Ozymandias — Turn-Pipeline

> Implementierung: `backend/app/services/turn_service.py`  
> API-Endpunkt: `POST /turns`  
> Referenz: `OZY_WRITE_GATES.md`, `SENSITIVITY_ROUTING.md`, `RUST_CORE.md`

---

## Überblick

Der Turn ist die **zentrale Einheit** des Ozymandias-Systems. Jede Konversationsrunde mit dem Nutzer durchläuft eine vollständig orchestrierte Pipeline.

```
POST /turns
    │
    ▼
[Kill-Switch prüfen]
    │
    ▼
[Circuit Breaker prüfen]
    │
    ▼
[Sensitivity klassifizieren]
    │
    ▼
[Context assemblieren]     ← Claims + Episoden + Prozedurale Regeln
    │
    ▼
[LLM aufrufen]             ← Provider nach Sensitivity + Intent gewählt
    │
    ▼
[Claim-Extraktion]         ← Was hat der Nutzer mitgeteilt?
    │
    ▼
[Sensitivity-Filter]       ← Rust: filter_claims()
    │
    ▼
[Taint berechnen]          ← Rust: compute_taint()
    │
    ▼
[Write-Gate-Pipeline]      ← Für jeden extrahierten Claim:
│   ├── G1: Schema         ← Rust: validate_schema()
│   ├── G2: Provenance     ← Rust: check_provenance()
│   ├── G3: Conflicts      ← Rust: detect_conflicts()
│   ├── Approval-Check     ← Rust: resolve_approval()
│   ├── Taint-Check        ← Rust: check_tainted_action()
│   └── → Proposal / Claim erstellen
    │
    ▼
[Circuit Breaker inkrementieren]
    │
    ▼
[Audit-Log schreiben]
    │
    ▼
TurnResult zurückgeben
```

---

## Schritt 1: Kill-Switch und Circuit Breaker

```python
settings = await SettingsService(db).get_or_create(user_id)
if settings.kill_switch:
    raise ServiceError("Kill switch is active — all operations blocked")

await circuit_breaker.check(user_id=user_id, action_type="turn_process")
```

**Kill-Switch:** Wenn `kill_switch = true` in `user_settings`, werden **alle** Operationen blockiert. Kein LLM, keine DB-Writes, keine Connectoren. Sofort-Stop des gesamten Systems.

**Circuit Breaker:** Prüft ob der User in den letzten N Sekunden zu viele Aktionen gemacht hat. Bei Überschreitung: `429 Too Many Requests`. Redis-backed Velocity-Tracking.

---

## Schritt 2: Sensitivity-Klassifikation

```python
classification = await classify_sensitivity(payload.text, payload.channel)
payload_sensitivity = classification.sensitivity
```

Der Sensitivity-Classifier (`llm/sensitivity_classifier.py`) klassifiziert zuerst deterministisch per Keyword/Kanal und lässt nur unklare Fälle vom lokalen LLM einstufen. Er liefert eine `SensitivityClassification` mit Herkunft (`keyword` | `local_llm` | `degraded` | `system_channel`):

- S0: Normaler Alltagstext, öffentliche Infos
- S1: Persönlich, aber nicht sensitiv
- S2: Vertraulich (Gesundheit, Arbeit)
- S3: Strict (Finanzen, Security, API-Keys)
- S4: Intimate (persönliche Beziehungen, Sexualität)

**Resilienz:** Ist der lokale Classifier nicht erreichbar, degradiert die Einstufung nachvollziehbar zu **S1** (`source="degraded"`) statt hart fail-closed auf S3 — der Chat bleibt nutzbar. Deterministische S3/S4-Keyword-Treffer bleiben unberührt strikt lokal.

**Security-Override für S3/S4:**

```python
if payload_sensitivity in {S3, S4} and preferred_provider not in {"ollama", "lmstudio"}:
    preferred_provider = None  # Cloud-Provider explizit deaktiviert
    preferred_model = None
```

S3/S4-Turns laufen **immer** auf lokalem Provider, unabhängig von den User-Einstellungen.

### Optional: Live-Web (vor der Claim-Extraktion)

Ist Live-Web aktiv (`use_live_web` / `live_web_enabled`, Modus ≠ `off`), holt der `LiveWebService` vor der LLM-Antwort Web-Kontext: **S0–S2** direkt, **S3** nur mit expliziter Bestätigung (sonst `LiveWebPermissionRequiredError` → HTTP 409), **S4** gesperrt (`live_web_blocked_for_s4`). Das Ergebnis wird als Kontextblock in den Prompt eingebettet; Fehler werden als `live_web_error` ausgewiesen, ohne den Turn abzubrechen.

---

## Schritt 3: Context Assembly

```python
context_block = await ContextAssembler(db).assemble(
    user_id=user_id,
    sensitivity=payload_sensitivity,
    provider_is_local=provider_is_local,
)
```

Der Context Assembler baut das Arbeitsgedächtnis für den Turn:

1. **Prozedurale Regeln** — Immer vollständig geladen (Tonfall, Arbeitsweise)
2. **Semantische Claims** — Gefiltert nach Sensitivity + Token-Budget
3. **Episodische Suche** — Semantisch + Keyword-Hybrid, Intent-Silo-getrennt
4. **Token-Budget** — Rust: `allocate_token_budget()` — harte Obergrenze

```python
messages = [
    {"role": "system", "content": OZY_SYSTEM_PROMPT},
    {"role": "system", "content": context_block},  # Memory-Block
    {"role": "user", "content": payload.text},
]
```

---

## Schritt 4: LLM-Routing und -Aufruf

```python
llm_response = await llm_router.route(
    intent="general_turn",
    sensitivity=payload_sensitivity,
    messages=messages,
    preferred_provider=preferred_provider,
    preferred_model=preferred_model,
    preferred_local_provider=preferred_local_provider,
    preferred_local_model=preferred_local_model,
)
```

**Provider-Auswahl-Logik:**

```
S3/S4           → Nur lokaler Provider (Ollama/LM Studio)
intimate_reflection → Nur lokal
tool_call, critical_action → OpenAI (höchste Tool-Call-Zuverlässigkeit)
creative, talk  → Gemini
claim_extraction → DeepSeek
work (default)  → DeepSeek
```

Wenn der präferierte Provider nicht verfügbar ist, Fallback auf jeden konfigurierten Provider (nur im Dev-Bypass-Modus).

---

## Schritt 5: Claim-Extraktion

```python
claims = await claim_extractor.extract(
    llm_response_text=llm_response.content,
    original_message=payload.text,
    sensitivity=sensitivity,
    turn_id=turn_id,
)
```

Der `ClaimExtractor` sendet LLM-Response + Original-Message an DeepSeek (oder lokalen Provider bei S3/S4) mit einem strukturierten Prompt, der nach extrahierbaren Fakten fragt.

**Output:** Liste von `ClaimData`-Objekten. Falls keine Fakten extrahierbar: leere Liste.

---

## Schritt 6: Sensitivity-Filter (Rust)

```python
sensitivity_output = rust_bridge.filter_claims(
    SensitivityFilterInput(
        claims=extracted_claims,
        intent_type="general_turn",
        provider_is_local=_provider_is_local(provider_used),
        provider_is_encrypted=_provider_is_encrypted(provider_used),
    )
)
```

Filtert Claims, die zu sensitiv für den aktuellen Provider sind:

- S4-Claims werden herausgefiltert, wenn der Provider nicht lokal ist
- S3-Claims werden herausgefiltert, wenn der Provider weder lokal noch verschlüsselt ist
- `filtered_count` wird im TurnResult ausgewiesen

---

## Schritt 7: Taint-Berechnung (Rust)

```python
taint_summary = rust_bridge.compute_taint(
    TaintContext(chunks=[_claim_to_taint_chunk(claim) for claim in extracted_claims])
)
```

Berechnet den **effektiven Taint** aller extrahierten Claims:

- Niedrigster TrustLevel aller Claims → `effective_trust`
- Höchster Sensitivity-Level → `effective_sensitivity`
- Hat irgendeiner T0 → `is_tainted = true`

Der Taint-Summary fliesst in die Taint-Checks der Write-Gate-Pipeline.

---

## Schritt 8: Write-Gate-Pipeline (pro Claim)

Für jeden Claim aus `sensitivity_output.allowed` läuft die vollständige Write-Gate-Pipeline:

### G1: Schema-Validierung

```python
g1_result = rust_bridge.validate_schema(WriteGateInput(proposal=proposal))
if g1_result != "SchemaValid":
    → Claim abgelehnt, AuditLog: ActionBlocked
    continue
```

### G2: Source Provenance

```python
g2_result = rust_bridge.check_provenance(proposal)
if g2_result.locked_to_tentative:
    effective_claim = claim.model_copy(
        update={"verification_state": VerificationState.tentative}
    )
```

`model_inferred`- und `connector_data`-Claims werden **hart auf tentative** gelockt, unabhängig davon, was das LLM sagt.

### G3: Conflict Detection

```python
existing_models = await claim_service.list_claims(user_id=user_id, subject=claim.subject)
existing_claims = [_claim_model_to_data(item) for item in existing_models]
g3_result = rust_bridge.detect_conflicts(proposal, existing_claims)
conflict_result = g3_result.result
```

Wenn `ConflictGroup` erkannt: `ConflictGroup`-Eintrag in DB → `conflict_group_id` für Proposal.

### Approval- und Taint-Check

```python
approval_decision = rust_bridge.resolve_approval(ApprovalRequest(
    action_type="memory_write",
    approval_class=ApprovalClass.class2,
    authority_level=AuthorityLevel.A1,
    payload_sensitivity=claim.sensitivity,
))

taint_decision = rust_bridge.check_tainted_action(TaintActionCheck(
    taint_summary=taint_summary,
    proposed_class=ApprovalClass.class2,
))
```

Wenn `TaintDecision.Block` → Claim abgelehnt.
Wenn `ApprovalDecision.Denied` → Claim abgelehnt.

### Routing: Proposal vs. direktes Claim-Create

```python
requires_hitl = (
    conflict_group_id is not None      # Konflikt erkannt
    or not g2_result.auto_confirm_eligible  # Kein User-Explicit
    or "EscalatedTo" in approval_decision   # Eskaliert
    or "Escalate" in taint_decision         # Taint-Eskalation
)

if requires_hitl:
    → Proposal erstellen (Dashboard-Inbox)
else:
    → Claim direkt erstellen (auto_confirmed)
```

---

## Schritt 9: Audit und Response

```python
await circuit_breaker.increment(user_id=user_id, action_type="turn_process")

await audit.log(
    event_type=AuditEventType.turn_processed,
    result=AuditResult.success,
    sensitivity=taint_summary.effective_sensitivity,
    payload=result_payload.model_dump(),
)

return TurnResult(
    turn_id=turn_id,
    response_text=llm_response.content,
    provider=provider_used,
    model=model_used,
    claims_processed=len(sensitivity_output.allowed),
    filtered_count=sensitivity_output.filtered_count,
    results=[...],           # ClaimProcessResult pro Claim
    taint_summary=taint_summary,
)
```

---

## TurnRequest (API)

```python
class TurnRequest(BaseModel):
    text: str                           # Nutzer-Nachricht
    intent: str = "work"               # work|talk|creative|tool_call|...
    conversation_id: UUID | None        # Für Gesprächs-Kontext
    channel: Channel = Channel.web      # web|telegram|system|celery
    provider: str | None                # Bevorzugter Provider überschreiben
    model: str | None                   # Bevorzugtes Modell überschreiben
    preferred_local_provider: str | None
    preferred_local_model: str | None
    claims: list[ClaimData] | None      # Override: Claims direkt übergeben (Tests)
```

## TurnResult (Response)

```python
class TurnResult(BaseModel):
    turn_id: str
    response_text: str | None          # LLM-Antwort
    reasoning_content: str | None      # DeepSeek Reasoning (falls vorhanden)
    provider: str                      # Verwendeter Provider
    model: str                         # Verwendetes Modell
    claims_processed: int              # Anzahl durch Write-Gates gelaufene Claims
    filtered_count: int                # Durch Sensitivity-Filter abgelehnte Claims
    results: list[ClaimProcessResult]  # Ergebnis pro Claim
    taint_summary: TaintSummary        # Effektiver Taint des Turns
```

## ClaimProcessResult (pro Claim)

```python
class ClaimProcessResult(BaseModel):
    claim_ref: str          # "subject:attribute:value"
    status: str             # created|proposal_created|rejected|filtered_out
    claim_id: str | None    # Wenn direkt erstellt
    proposal_id: str | None # Wenn Proposal erstellt
    reason: str | None      # Bei rejected/filtered_out
```

---

## Fehlerbehandlung

Alle Fehler in der Turn-Pipeline werden:

1. Im Audit-Log als `AuditResult.failed` protokolliert
2. Als HTTP-Fehler zurückgegeben

| Fehler | HTTP | Ursache |
|---|---|---|
| Kill-Switch aktiv | 423 Locked | `settings.kill_switch = true` |
| Circuit Breaker ausgelöst | 429 Too Many Requests | Velocity-Limit überschritten |
| Kein Provider konfiguriert | 423 Locked | Kein API-Key für nötigen Provider |
| InvariantViolation | 409 Conflict | Versuch, locked Claim zu überschreiben |
| LLM-Fehler | 500 | Provider nicht erreichbar |

**Partial Failure:** Einzelne Claim-Fehler in der Write-Gate-Pipeline beenden den Turn **nicht**. Nur der betroffene Claim wird abgelehnt (`status: "rejected"`), der Rest läuft durch. Der `response_text` wird immer zurückgegeben.
