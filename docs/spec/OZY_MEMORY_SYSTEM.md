# OZY Memory-System — Technische Spezifikation

> Referenz: `OZY_ZUSAMMENFASSUNG_v5` §6, `OZY_CONTRACTS_SPEC_v1`, `OZY_DB_Schema.sql`  
> Implementierung: `backend/app/services/claim_service.py`, `backend/app/services/proposal_service.py`, `backend/app/services/decay_service.py`, `rust/ozy-core/src/decay_engine.rs`

---

## Überblick

Das Ozymandias Memory-System ist **vierschichtig** und trennt strikt zwischen flüchtigem Arbeitskontext, chronologischer Geschichte, strukturierten Fakten und Verhaltensregeln.

**Kernidee:** Claims sind die einzige Wahrheitsschicht. Archive sind Quellen. Vektoren sind nur ein Index. Rohquellen werden append-only archiviert — niemals überschrieben.

---

## Die 4 Schichten

### Schicht 1: Arbeitsgedächtnis

| Attribut | Wert |
|---|---|
| **Funktion** | Aktuelle Session, letzter Kontext, aktiver Turn |
| **Speicher** | LLM Context Window (nicht persistent) |
| **Lebensdauer** | Nur für die Dauer eines Turns/einer Session |
| **Zugriff** | Context Assembler baut es auf, LLM verarbeitet es |

Das Arbeitsgedächtnis ist **nicht in der Datenbank**. Es wird für jeden Turn neu zusammengestellt (Context Assembly) und nach Abschluss des Turns verworfen. Nichts aus dem Arbeitsgedächtnis wird automatisch dauerhaft gespeichert — das ist Aufgabe der Claim-Extraktion.

### Schicht 2: Episodisches Gedächtnis

| Attribut | Wert |
|---|---|
| **Funktion** | Chronologische Aufzeichnung aller Gespräche und Events |
| **Speicher** | PostgreSQL Tabelle `episodes` + pgvector Embedding |
| **Lebensdauer** | Langfristig (append-only) |
| **Zugriff** | Semantische Suche, Gesprächsverlauf-Rekonstruktion |

```sql
-- episodes: Append-only Gesprächsarchiv
episode_id, user_id, conversation_id, turn_index,
role (user|assistant|system), content,
sensitivity, extracted, extraction_job_id,
embedding vector(1536)  -- pgvector für semantische Suche
```

**Wichtig:** Episoden sind die **Rohquelle**. Aus Episoden werden durch Batch-Jobs Claims extrahiert (Episodisch → Semantisch). Die Episode selbst wird nie verändert — nur `extracted = true` gesetzt.

### Schicht 3: Semantisches Gedächtnis (Claims)

| Attribut | Wert |
|---|---|
| **Funktion** | Strukturierte Fakten über die Welt und den Nutzer |
| **Speicher** | PostgreSQL Tabelle `claims` |
| **Lebensdauer** | Bis zum Decay oder expliziter Löschung |
| **Zugriff** | Direkte Filterung, Conflict Detection, Context Assembly |

Das semantische Gedächtnis ist die **einzige Wahrheitsschicht**. Es speichert keine Meinungen oder Zusammenfassungen, sondern strukturierte Fakten:

```
subject:   "alex"           (Wer/Was)
attribute: "wohnort"        (Welche Eigenschaft)
value:     "Beispielstadt"  (Der Wert)
content:   "Alex wohnt in Beispielstadt."
```

Vollständige Feld-Beschreibung: Siehe `OZY_DB_Schema.sql` (Tabelle `claims`) und `OZY_CONTRACTS_SPEC_v1` (Struct `ClaimData`).

### Schicht 4: Prozedurales Gedächtnis

| Attribut | Wert |
|---|---|
| **Funktion** | Arbeitsstil, Tonfall, Mail-Verhalten, Formatierungsregeln |
| **Speicher** | PostgreSQL Tabelle `procedural_rules` |
| **Lebensdauer** | Dauerhaft, bis zur expliziten Deaktivierung |
| **Zugriff** | Bei **jedem** Turn geladen, unabhängig vom Intent |

```sql
-- procedural_rules: Verhaltensregeln
rule_id, user_id, category (tone|mail_behavior|work_style|formatting|security),
rule ("Immer duzen", "Mails auf Deutsch", "Keine Emojis"),
priority, active, sensitivity, source_type
```

Prozedurale Regeln werden als System-Prompt-Extension bei jedem Turn an das LLM übergeben. Sie sind die „Persönlichkeit" von Ozy.

---

## Claim-Lebenszyklus

```
[LLM extrahiert Claim]
        ↓
[Proposal erstellt (pending)]
        ↓
    G1–G3 prüfen
        ↓
[Dashboard-Inbox] ← Nutzer entscheidet
        ↓              ↓
  [confirmed]     [rejected]
        ↓
  [Claim aktiv]
        ↓
  [Decay prüft]
        ↓
 confidence fällt ← Tentative: 10% pro Zyklus
        ↓
confidence < 0.1 → [archived / retracted]
```

### Verification States

| State | Bedeutung | Decay-Verhalten |
|---|---|---|
| `tentative` | Unbestätigt — vom LLM abgeleitet oder aus Connector | Schneller Decay (HWZ ≈ 14 Tage) |
| `confirmed` | Vom Nutzer bestätigt | Langsamer Decay (HWZ ≈ 2 Jahre) |
| `superseded` | Durch neueren Claim ersetzt (G3 TemporalSuccession) | Kein Decay — archiviert |
| `retracted` | Vom Nutzer gelöscht | Kein Decay — archiviert |

---

## Memory Decay — Garbage Collection

### Warum Decay?

Ozymandias ist ein Langzeit-System. Ohne Decay würden tentative Claims (z.B. „Nutzer plant Urlaub nach Spanien nächsten Sommer") ewig in der DB bleiben, obwohl sie längst veraltet sind. Decay ist die automatische Selbst-Bereinigung.

### Decay-Formel (exponentieller Zerfall)

```
C_t = C_0 · 0.9^n
```

Wobei `n` die Anzahl der Decay-Zyklen ist. Pro Zyklus verliert ein tentative Claim 10% seiner Konfidenz.

**Implementierung:** `rust/ozy-core/src/decay_engine.rs::evaluate_decay()`

### Decay-Regeln nach Lifecycle

| Lifecycle | Decay-Verhalten |
|---|---|
| `permanent` | Kein Decay — bleibt für immer |
| `session` | Sofort bei Decay-Run `Expire` → `retracted` |
| `expiry` | Wenn `valid_to < now` → `Expire` → `retracted` |
| `temporary` | Confidence × 0.9 pro Zyklus; < 0.3 → `Archive` → `retracted` |

### Locked Claims

Claims mit `user_locked = true` sind **immun gegen Decay**. Confidence bleibt bei 1.0 (oder dem Wert beim Lock). Diese Regeln können nur vom Nutzer explizit gesetzt/aufgehoben werden.

### Celery-Task

```python
# backend/app/services/decay_service.py
@shared_task(name="ozy.decay.run")
def run_decay_task(user_id: str) -> dict[str, int]:
    """Täglich ausgeführt per Celery Beat."""
    # Lädt alle decay_eligible Claims des Users
    # Ruft rust_bridge.evaluate_decay() auf
    # Wendet Aktionen an: Keep / ReduceConfidence / Expire / Archive
    # Erstellt Audit-Log-Eintrag
```

Konfigurierbar über `user_settings.decay_interval_hours` (Standard: 24h) und `user_settings.decay_confidence_threshold` (Standard: 0.1).

### Dual-Axis: Confidence ≠ Relevance

**KRITISCH:** `confidence` und `relevance` sind zwei völlig unabhängige Achsen.

- **Confidence**: „Ist das wahr?" — Wird nur durch menschliche Bestätigung oder Decay verändert
- **Relevance**: „Wie wichtig ist das gerade?" — Wird durch Zugriff (wurde der Claim im LLM-Output zitiert?) berechnet

Nutzung erhöht **niemals** automatisch die Confidence. Das würde einen Self-Reinforcement-Loop erzeugen, bei dem häufig verwendete Claims zunehmend als wahr gelten.

Relevance wird über `claim_access_log` (Tabelle) berechnet:
```sql
access_id, claim_id, user_id, intent_type,
was_cited (bool),  -- wurde im LLM-Output referenziert
provider_id, accessed_at
```

---

## Context Assembly

Bevor ein Turn ans LLM geht, assembliert der Context Assembler das Arbeitsgedächtnis:

```
1. Prozedurale Regeln laden (immer vollständig)
2. Relevante Claims laden (Sensitivity-gefiltert, Token-Budget-begrenzt)
3. Episodische Suche (semantisch + keyword hybrid, nach Intent-Silo)
4. Token-Budget prüfen (Knapsack: harte Obergrenze, Priorität nach Projektverknüpfung)
5. RetrievalPackage bauen (chunk_id, source_name, trust_level, content)
```

### Token-Budget

Der Token Budget Allocator (`rust/ozy-core/src/token_budget.rs`) berechnet pro Intent:
- `max_claims`: Maximale Anzahl Claims im Kontext
- `max_tokens_per_claim`: Token-Limit pro Claim
- `truncation_needed`: Ob Claims gekürzt werden müssen

Standard: 4.000 Tokens für RAG, strikte Truncation, Priorisierung nach Projektverknüpfung und `last_accessed`.

### Intent-Silos

Context Assembly ist **intent-routed**. Der Intent eines Turns bestimmt, welche Silos durchsucht werden:

| Intent | Silo |
|---|---|
| `work` | Arbeits-Claims, Projekte, Work-Episoden |
| `health` | Health-Claims |
| `finance` | Finance-Claims (S3 → nur lokal) |
| `intimate_reflection` | S4-Claims (nur mit S4-Lockdown + lokalem Provider) |
| `tool_call` | Keine RAG — nur System-Prompts und Tool-Definitionen |

HackTheBox-Writeups und Steuerunterlagen werden **niemals** im selben Silo gemischt.

---

## Memory v2 — Authority Lanes (additive Erweiterung)

> Implementierung: `backend/app/memory/` (reine, I/O-freie Logik), `backend/app/services/memory_*.py`, `backend/app/services/behavioral_rule_service.py`, API unter `/memory`. Orientiert an der `agent-memory-skill`-Architektur.

Memory v2 erweitert das semantische und prozedurale Gedächtnis um **Authority Lanes** und ein deterministisches, embedding-freies Retrieval — ohne die bestehenden Konzepte (Claims, Versionen, Decay, Audit) zu ersetzen.

### Authority Lanes

Jeder Claim trägt eine Lane (`claims.authority_class`) mit eigener Policy:

| Lane | Zweck | Besonderheiten |
|---|---|---|
| `identity` | Stabile Identitätsfakten | single-valued, immer injizierbar, kein/seltener Decay |
| `preference` | Vorlieben/Stil | mittlerer Decay |
| `evidence` | Beobachtungen/Fakten (Default) | normaler Decay |
| `authorization` | Berechtigungen/Freigaben | single-valued, **nie** in Prompts injiziert |
| `procedural` | Verhaltensregeln | nur über Review-Gate, beschränkt injiziert |

Eine **Source-Trust-Write-Policy** ordnet jeder Lane erlaubte Quellen zu (Rang: `observation > conversation > inference > tool > external`). Für single-valued Lanes (`identity`, `authorization`) löst eine deterministische Konfliktauflösung, ob ein neuer Fakt den alten nach Trust/Aktualität ablöst. Ein **Rebound-Schutz** (Redis-gestützt) deckelt Nicht-Identity-Writes nach Inaktivitätsphasen.

### Query-aware Recall

Statt reiner Sensitivity-Filterung bewertet das Retrieval Kandidaten deterministisch: deutsche Text-Normalisierung (Umlaut-Folding, leichtes Stemming, Stopwörter), editierbarer Synonym-Map, Term-Coverage und Confidence — mit **Pro-Lane-Budgets**. Identity-Fakten werden immer eingebunden, Authorization-Fakten nie.

### Zusätzliche Schichten

- **Recall-Snippets** (`recall_snippets`): Roh-Gesprächsausschnitte für wörtlichen Abruf.
- **Entity-Relations-Graph** (`memory_entities`, `memory_entity_relations`): gerichtete Beziehungen zwischen Entitäten.
- **Verhaltensregeln** (`behavioral_rules`, `behavioral_rule_conflicts`): selbstgeschriebene Regeln mit **Pflicht-Review (Guardian-Approval)**, deterministischer Konflikterkennung (direkt, Interaktion, Budget, Cap) und beschränkter, sanitisierter Injektion.

### Provenance & Snapshots

Die Historie eines Memory-Items wird aus dem Append-Only-Audit-Log rekonstruiert; strukturierte Memory-Daten lassen sich als Snapshot exportieren und wiederherstellen. Decay/Cleanup ist lane-gekoppelt (`half_life_days`, `ttl_days`) und läuft als Celery-Task.

---

## Transparenz-Funktionen

Als Nutzer kannst du jederzeit:

- **„Was weißt du über mich?"** → Memory-Browser im Dashboard, alle Claims mit Filtern (Sensitivity, Verification State, Subject)
- **„Ändere X"** → Neuer Claim mit `valid_from = now`, alter Claim wird `superseded`
- **„Vergiss Y"** → Claim wird `retracted` (soft delete), optional physische Löschung
- **„Exportiere alles"** → Vollständiger JSON-Export aller Claims (Datenportabilität, DSGVO)
- **Conflict Groups** → Im Dashboard sichtbar, Nutzer entscheidet welcher Claim der richtige ist
- **Pending Proposals** → Dashboard-Inbox zeigt alle unbestätigten LLM-Vorschläge

---

## Versionierung und Integrität

Jede Änderung an einem Claim erzeugt einen neuen Eintrag in `claim_versions`:

```
Version 1: {subject: "alex", attribute: "wohnort", value: "Berlin"}   hash: abc123
Version 2: {subject: "alex", attribute: "wohnort", value: "Beispielstadt"}   hash: def456, prev: abc123
```

Die Hash-Chain ermöglicht Integritätsprüfungen: Wenn `hash(version_n.content_snapshot) ≠ version_n.version_hash`, wurde die Version nachträglich manipuliert.
