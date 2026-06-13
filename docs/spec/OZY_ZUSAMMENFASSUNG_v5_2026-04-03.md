# Ozymandias — Strukturierte Zusammenfassung

> Destilliert aus `OZY_CHAT_KONSOLIDIERT.md` (Brainstorming-Stand + Cursor-Session-Transkript)

---

## 1. Vision & Identität

Ozymandias (Ozy) ist ein **persönlicher KI-Assistent**, der das Leben seines Nutzers aufzeichnen, beraten, proaktiv handeln und über Jahre hinweg kohärent funktionieren soll. Kein Chatbot — eine **Schaltzentrale**.

**Leitbild:** Weniger Hersteller-Abhängigkeit, weniger Tool-Chaos, weniger Kontextwechsel, bessere Kostenkontrolle. Ozy ist gleichzeitig technisches Projekt und **Kosten-/Unabhängigkeitsprojekt**.

---

## 2. Grundprinzipien

- **Boundary-first, Contracts-first, Fail-closed, Privacy-first, auditierbar.**
- Ehrliche Fehler statt Fake-Erfolg oder weichgespülter Scheinantworten.
- Best-of-breed: gute Muster übernehmen, kein Framework blind kopieren.
- Nicht vendor-locked, nicht OpenAI-only.
- API-first / lokal-first — Consumer-Abos und fremde Chat-UIs sind Übergang, nicht Ziel.
- Computer Use ist Ausnahme/Fallback, nicht Standardpfad.

---

## 3. Betriebsmodell

- **VPS/Cloud-first** für 24/7-Betrieb, Telegram-Anbindung, Synchronisation.
- Lokale Komponenten bleiben **first-class** für Privacy, Offline, sensible Daten und Fallback.
- Zwei Modi bereits vorgesehen: **Guardian** (HITL für alles) und **Autopilot** (automatische Ausführung mit Undo-Window).
- Dashboard als PWA — dunkel, professionell, Command-Center-Ästhetik (NOC-Theme).
- Telegram als primärer mobiler Kanal.

---

## 4. Provider-Strategie

| Rolle | Provider | Begründung |
|---|---|---|
| **Default / Work** | DeepSeek-V3 (API) | Günstig ($0.28/1M Input, $0.42/1M Output), 128K Kontext, gut für strukturierte Arbeit, Akten, Extraktion |
| **Talk / Quatschen / Kreativität** | Gemini (API) | Kreativ, kostenvertretbar, gut zum stundenlangen Unterhalten |
| **Spezialrollen / Tool-Calls** | OpenAI GPT-4o/5 (API) | Höchste Verlässlichkeit bei Tool-Calls und kritischen Aktionen |
| **Sensibel / Offline / Privacy** | Lokale Modelle (Ollama/LM Studio) | Keine Token-Kosten, 100% Privacy, für S3/S4-Daten |
| **Batch / Nachtjobs** | DeepSeek Batch-API | 50% Rabatt, zeitversetzt (24h-Fenster) |

**Wichtig:** Claude ist explizit kein Standardpfad — als zu teuer und im Kosten-/Nutzen-Verhältnis unerwünscht bewertet. Provider-Routing muss vom Nutzer einstellbar sein, nicht in Stein gemeißelt.

**Routing-Kriterien:** Taskklasse, Risiko, Datenschutz, Latenz, Kosten — nicht nur Modellname. Technische Ausfälle dürfen Fallbacks triggern, aber Safety-/Policy-Blocks dürfen **nicht blind** durch Provider-Wechsel umgangen werden.

---

## 5. Kosten- & Token-Strategie

- **Token sparen ist Kernziel**, kein Nebenwunsch.
- Requests reduzieren, Input klein halten, große Modelle nur wo nötig.
- **Prompt Caching** als wichtigster Hebel (DeepSeek hat automatisches Disk-Caching: 0.1¥/1M Cache-Hit vs. 1¥/1M Miss).
- Stabile Prefixe, identische Tool-/Schema-Definitionen, saubere Context-Struktur.
- **Batch API** für: Dokumentindizierung, Massenbewertung, Connector-Imports, Backfills, Evals, Memory-Konsolidierung.
- **Flex Processing** strikt von Live-Pfaden trennen — nicht für Telegram oder zeitkritische Antworten.
- Gesamtkostenmodell denken: Abos ablösen, APIs, lokale Modelle, Nachtjobs verrechnen.
- Dashboard soll nach jedem Turn die **exakten Kosten in Cent** anzeigen.

---

## 6. Memory-System (Kernblock)

### 6.1 Vier Schichten

| Schicht | Funktion | Speicher |
|---|---|---|
| **Arbeitsgedächtnis** | Aktuelle Session, letzter Kontext | LLM Context Window |
| **Episodisches Gedächtnis** | Chronologische Erinnerungen an Gespräche/Events | Vektordatenbank + Postgres |
| **Semantisches Gedächtnis** | Harte Fakten als **Claims** (nicht lose Summaries) | Postgres (strukturiert) |
| **Prozedurales Gedächtnis** | Arbeitsstil, Regeln, Ton, Präferenzen, Mail-Verhalten | Postgres (Tabelle `procedural_rules`) |

**Kernidee:** Claims als Wahrheit, Archive als Quelle, Vector nur als Index. Rohquellen append-only archiviert.

### 6.2 Claim-Schema (Kernfelder)

```
claim_id, user_id,
subject, attribute, value,
content, memory_type,
verification_state, confidence, source_ref, source_type,
sensitivity, trust_level, handling_policy,
user_locked, decay_eligible, lifecycle,
valid_from, valid_to, ingested_at, superseded_at,
review_due, last_reviewed, last_accessed
```

Verification States: `confirmed`, `tentative`, `superseded`, `retracted`.

### 6.3 Die 5 Memory-Write-Gates

| Gate | Funktion |
|---|---|
| **1. Structured Proposal** | LLM hat keinen direkten DB-Zugriff. Generiert JSON-Proposal, validiert durch Pydantic-Schema. |
| **2. Source Provenance** | `user_explicit` → beschleunigtes Confirm. `model_inferred`/`connector_data` → hart auf `tentative` gelockt. |
| **3. Conflict Detection** | Prüfung gegen bestehendes Memory. Widersprüche werden in Conflict Groups gekapselt, nicht überschrieben. |
| **4. Human-in-the-Loop** | Dashboard-Inbox: Confirm / Reject / Edit. Optional `user_locked = true` für unveränderliche Fakten. |
| **5. Append-Only Commit** | Versionierung in `claim_versions`, vollständiger Audit-Trail. |

### 6.4 Memory Decay (Garbage Collection)

- **Locked** (`user_locked`): Immun, Confidence bleibt 1.0.
- **Confirmed**: Halbwertszeit ~2 Jahre, sehr langsamer Zerfall.
- **Tentative**: Halbwertszeit ~14 Tage (konfigurierbar), schneller Zerfall.
- Mathematik: Exponentieller Zerfall `C_t = C_0 · e^(-λt)`.
- **Refresh**: Wird ein Claim im Kontext geladen und vom LLM zitiert, wird der Decay-Timer zurückgesetzt.
- **Culling**: Confidence < 0.1 → Status `archived` (Soft Delete), nach Retention-Policy physisch gelöscht.

**Kritische Unterscheidung (Dual-Axis):** `confidence ≠ relevance`. Nutzung erhöht Relevanz, nicht Wahrheit. Kein Self-Reinforcement-Loop.

### 6.5 Vergessen, Korrigieren, Transparenz

- „Ändere X" → neue Claim-Version, alte wird `superseded`.
- „Vergiss Y" → `retracted` + optionale Löschung.
- „Exportiere alles" (Datenportabilität).
- „Was weißt du über mich?" (Transparenzansicht im Dashboard).
- Schema-Migrationen, Embedding-Reindex bei Modellwechsel, regelmäßige Backups.

---

## 7. Sensitivity & Trust Labels

### Sensitivity-Stufen

| Label | Stufe | Routing |
|---|---|---|
| **S0** | Öffentlich | Alle Provider |
| **S1** | Intern | Alle Provider, aber nicht öffentlich |
| **S2** | Vertraulich | Nur vertrauenswürdige Provider |
| **S3** | Strict/Ops (Finanzen, Keys, Verträge) | Nur lokale Modelle (Ausnahme: verschlüsselt auf Cloud OK) |
| **S4** | Intimate (Sexualität, Beziehung) | Nur lokale Modelle, S4-Lockdown, Air-gapped vom Rest |

**S4-Regeln:** Kein Heartbeat/Briefing, kein proaktives Laden. Nur bei explizitem Intent (`intimate_reflection`). Lokales Modell **ohne harte Guardrails** nötig (bereits vorhanden), weil Cloud-Provider sexuellen Content blocken. Ozy darf bei S4 freie Meinungsbildung betreiben (expliziter Wunsch). „Nuclear" als Kategorie entfällt — was nicht intim ist, gehört nach S3 oder darunter.

**Handling-Policies:** `cloud_ok_encrypted`, `local_preferred`, `local_only`, `s4_isolated`. Niemals unverschlüsselt auf Cloud.

### Trust-Level

| Level | Bedeutung |
|---|---|
| **T0** | Untrusted (Webseiten, ungeprüfte externe Quellen) |
| **T1** | External verified (geprüfte Quellen) |
| **T2** | System-internal (eigene Connectoren) |
| **T3** | User-confirmed (vom Nutzer bestätigt) |

Taint-Tracking auf Chunk-Level, nicht Prompt-Level.

### Autoritäts-Level

| Level | Rolle | Befugnisse |
|---|---|---|
| **A0** | Untrusted Source (Connectoren, Mails, RAG) | Nur Daten liefern, nie Aktionen absegnen |
| **A1** | Standard User (Telegram, Web-UI mit JWT) | Klasse 1 & 2 bestätigen, Proposals freigeben |
| **A2** | Root/Break-Glass (lokale Console / Hardware-Token) | Klasse 4, S3-Daten, Core-Invarianten ändern |

---

## 8. Governance — Die 5 Approval-Klassen

| Klasse | Typ | Beispiele | Freigabe |
|---|---|---|---|
| **0** | Read & Ingest | MCP liest Logfile, Connector zieht Daten, RAG-Index | Keine Freigabe nötig |
| **1** | Reversible Actions | E-Mail-Draft, Termin eintragen, Memory-Proposal | Autopilot mit Undo-Window |
| **2** | Memory & Identity | Fakten bestätigen, Conflicts auflösen, Identity-Policy ändern | Immer Guardian, kein Autopilot |
| **3** | Remote Writes | Notion-Page updaten, E-Mail senden, GitHub Commit | Hard Confirm mit Payload-Vorschau |
| **4** | Destructive & Root | Skript-Ausführung, Dateien löschen, Finanzen, DB-Drops | High-Friction (Eingabe „CONFIRM" oder Re-Auth) |

**Grundregel:** Das System stuft immer nach oben, niemals nach unten.

---

## 9. Edge-Case-Architektur (Gehärtete Sicherheit)

| Edge Case | Lösung |
|---|---|
| **Daten-Exfiltration** (Klasse 0 → 3) | Context Tainting: Sensitive Pfade kontaminieren den Turn, alle folgenden Aktionen werden hochgestuft |
| **State-Changing Read** (Fake Klasse 0) | Capability Contracts: Jeder Connector deklariert Side Effects, kein blinder HTTP-Methoden-Trust |
| **API-DDoS / Kosten-Loop** | Circuit Breaker + Velocity Tracker: >N Aktionen/Typ in X Minuten → Klasse 4 Escalation |
| **Trojanisches Pferd** (Klasse 1 → 2) | Strict Source Provenance: Externe Systeme bleiben untrusted, auch selbst exportierte Daten |
| **Meta-Mutation** (System hackt sich selbst) | Core Invariants: Alle Selbst-Änderungen hardcoded Klasse 2/4, Autopilot darf nie eigene Fesseln lösen |
| **Partial Failure** | Saga Pattern: Execution Plan mit Undo-Strategien, Rollback bei Teilfehler |
| **Race Conditions** | Optimistic Concurrency Control: Version-Hash pro Entity, StaleDataError bei Konflikt |
| **Poisoned Pipeline** (Tool A → Tool B) | Taint Tracking: Untrusted-Tags propagieren durch Tool-Chain, finale Mutation immer HITL |
| **Calendar Side Effects** (Attendees) | Deep Action Profiling: Trigger-Felder im Payload → automatische Escalation |
| **Identity Spoofing** (E-Mail-Inhalt) | Strict Channel Auth: Nur JWT/Telegram-Channel haben User-Rechte, E-Mail-Text = parsed_content |
| **Payload Sensitivity Leak** (S4 via Klasse 3) | Payload-Sensitivity-Check: Attachments und Payloads bekommen eigene Sensitivity-Bewertung. S4-Content + Remote Write (E-Mail, Upload, Share) → Warnung + Escalation, egal ob Guardian oder Autopilot. Ozy blockt nicht, sondern warnt explizit was rausgeht. |

---

## 10. Context Assembly & RAG

- **Kein** „alles ins Kontextfenster kippen". Long Context ist kein Freifahrtschein.
- **Context Assembler** statt dumme Top-k-Suche.
- **Intent-Routed Silos**: Der Intent bestimmt das Such-Silo (HackTheBox-Writeups vs. Steuerunterlagen werden nie vermischt).
- **Hybrid Retrieval**: Vector (semantisch) + BM25/Keyword (harte Fakten wie CVEs, IPs, Hashes).
- **RetrievalPackage** als Schema: `chunk_id`, `source_name`, `trust_level`, `content` — immer getagged, nie nackter Text.
- **Token-Budgeting** („Knapsack"): Harte Obergrenze pro Turn (z.B. 4.000 Tokens für RAG), strikte Truncation, Priorisierung nach Projektverknüpfung.
- **Zitierzwang**: Output-Schema erzwingt `chunk_id`-Referenz, Pydantic-Validator wirft Error bei fehlender Quellenangabe.

---

## 11. Accuracy & Eval-Suiten

### 11.1 Fehlermodell

**Fehler zuerst klassifizieren**, nicht pauschal mit „mehr Kontext" erschlagen:

1. Kontextproblem?
2. Verhaltens-/Konsistenzproblem?
3. Contract-/Structured-Output-Problem?
4. Retrieval-/RAG-Problem?

**Reihenfolge:** Prompt Engineering → Contract + kleines Eval-Set → RAG (nur wenn Wissen fehlt) → Fine-Tuning (später, nur für Verhalten/Format/Konsistenz).

**Eval-driven** entwickeln, nicht nach Bauchgefühl. Produktionsreife ist **risikobasiert**, nicht eine globale Accuracy-Zahl.

### 11.2 Die 8 Eval-Suiten

**1. Policy / Safety Evals**
- S3/S4 dürfen nie an Cloud-Provider gehen.
- T0/T1/T2b dürfen nie direkt Truth-Mutationen auslösen.
- A0 darf nie privilegierte Intents triggern.
- S4 darf nie in Heartbeat, Briefing, Work oder Normal Recall auftauchen.
- Policy-Blockaden dürfen nicht blind per Fallback umgangen werden.

**2. Routing Evals**
- Richtiger Provider für Talk, Work, Sensitive, S4, Offline, Critical.
- Fail-closed, wenn lokaler Pflichtpfad nicht verfügbar ist.
- Session- und User-Overrides funktionieren, ohne harte Grenzen zu brechen.
- Spar-/Fallback-Modi werden korrekt gesetzt und sichtbar gemacht.

**3. Memory Evals**
- `user_explicit` wird korrekt als Proposal/Claim behandelt.
- `model_inferred` bleibt tentative.
- Conflict Groups entstehen korrekt.
- `user_locked` blockt unzulässige Änderungen.
- Confidence und Relevance bleiben getrennt (Dual-Axis).
- Nutzung erhöht nie automatisch Wahrheit.
- S4-Memory bleibt isoliert.

**4. Retrieval / Context Evals**
- Intent routet in das richtige Silo.
- Hybrid Retrieval findet harte Fakten und semantische Nähe.
- Retrieval Packages tragen Quelle, Trust, Taint und IDs korrekt.
- Citation Contract erzwingt echte Belege.
- Context Assembly hält Budgets ein, ohne blind zu zerstören.
- `full` / `compressed` / `partial` Context wird korrekt erkannt.

**5. Connector / MCP Evals**
- Side-effecting Reads werden nicht als Klasse 0 behandelt.
- Payload-Trigger eskalieren korrekt.
- Taint propagiert über Tool-Ketten.
- Connector-Daten überschreiben nie still lokales Truth-Memory.
- Circuit Breaker greift bei Volumen/Loops.

**6. Approval / Governance Evals**
- Klassen 0 bis 4 werden korrekt eingestuft.
- A1 kann Klasse 1/2/3 — A2 kann Klasse 4.
- Klasse 3 zeigt Payload, Diff und Zielsystem.
- Klasse 4 erzwingt High-Friction Confirm.
- Auto-Escalation und Trust-Decay greifen korrekt.

**7. Verification / Completion Evals**
- Platzhalter werden erkannt.
- Artefakte mit unplausibler Größe werden nicht als fertig markiert.
- Parse-, Symbol- und Coverage-Checks funktionieren.
- Partial Success landet korrekt in `partial_failure_orphaned` oder Rollback.
- Modell darf nie allein `verified_complete` behaupten.

**8. UX / Honesty Evals**
- Ozy markiert Spar-, Fallback- und Teilkontext-Modi sichtbar.
- Ozy tut nicht so, als hätte er mehr geprüft als tatsächlich geschehen.
- Ozy zeigt Einschränkungen ehrlich statt weichgespült.

---

## 12. MCP & Connectoren

**MCP (Local System Layer):**
- Dateisystem, lokale Skripte, Docker, Netzwerk.
- Strict Whitelisting (`allowed_tools`), Sandboxing, Path-Restriction.
- Lokales read-only MCP als MVP-Pfad.

**Connectors (Remote Cloud Layer):**
- Notion, Google Workspace, GitHub, externe APIs.
- Granulare Scopes (nicht Vollzugriff).
- Ingestion-Quarantäne: Daten gelten als untrusted.
- Schreibzugriffe immer über Action Preview + Confirm (Klasse 3).

**Trennung:** MCP = lokal, Connectors = remote. Connector-Daten dürfen nie automatisch bestehende Claims überschreiben.

---

## 13. Dashboard (Zielzustand)

| Seite | Funktion |
|---|---|
| **Home / Briefing** | Tages-Cockpit: Prioritäten, offene Aufgaben, Kalender, Risiken, proaktive Vorschläge |
| **Chat** | Text + Voice (Whisper STT + TTS), Telegram-Stil, Datei-Upload, von überall erreichbar |
| **Kalender** | Wochenansicht mit echten Google Calendar Events, Termin-Erstellung über Ozy |
| **Mail** | Inbox-Ansicht, Mail lesen/schreiben über Ozy |
| **Projekte** | Projektstatus, Events, Risiken, Links |
| **Memory** | Browser mit Filtern, Confirm/Reject/Delete, Conflict Groups sichtbar, Pending-Proposals |
| **Audit** | Chronologischer Feed aller Aktionen, filterbar, S4-Audit gestuft sichtbar |
| **Einstellungen** | Guardian/Autopilot, Kill Switches, Memory Decay Slider, Context Budgets, Ranking Weights, Heartbeat |

**Design:** Dunkles NOC-Theme (#0d1117), Glassmorphism, Neon-Akzente, Bento-Grid-Layout, PWA-tauglich, Modus-Indikator (Blau=Guardian, Orange=Autopilot, Rot=Kill-Switch).

**Interaktionskonzepte:** Swipe für Approve/Reject, Undo-Timer, interaktiver Memory-Graph, Token-Monitor, Integration-Status.

---

## 14. Sprache & Architektur

- **Python** als flexible Orchestrierungs- und LLM-Schicht.
- **Rust** als „strenger Notar" für Grenzen, Invarianten, Governance, Memory-Regeln, sicherheitskritische Kerne (Langfrist).
- **TypeScript/React** für UI/Frontend (Vite + Tailwind).
- **Postgres + pgvector** als primärer Datenspeicher.
- **FastAPI** als Backend.
- **Docker** für Deployment.
- **Celery** für Hintergrund-Tasks (Memory Decay, Konsolidierung).

---

## 15. Audit-System

- **Vollständig**: Wer hat was angefragt, was wurde entschieden, was wurde ausgeführt.
- **Append-only**: Nicht still überschreibbar.
- **Verschlüsselt**: Besonders bei sensiblen Vorgängen.
- **Zeitgestempelt** und **subjektgebunden** (Nutzer/Kanal/Prozess).
- **Zustandsgebunden**: Preview → Confirm → Execute → Rollback → Fail → Block.
- **Mit Provenance**: Prompt, Tool, Payload, Quelle.
- **Gesteuerte Sichtbarkeit**: S4-Audit darf nicht im normalen Dashboard-Screen erscheinen.

---

## 16. Persönliche Präferenzen des Nutzers

- Public-Beispieldaten werden bewusst generisch gehalten.
- Owner-Identität, Präferenzen und S4-Daten gehören in lokale Runtime-Konfiguration oder Memory, nicht ins Repository.
- Beispielhafte Präferenzen: Deutsch, Duzen, kurze Antworten, Privacy-first, Memory nur mit Governance.

---

## 17. Offene Blöcke (To-Do)

### Erledigt (Session 1–3)
- ~~Provider-Routing-Matrix~~ → Session 2: 15 Intents mit Provider-Zuordnung
- ~~Memory-Modelle~~ → Session 2: DB-Schema (OZY_DB_Schema.sql)
- ~~Approval-Klassen~~ → Session 1+2: Klassen 0–4 mit Triggern
- ~~Write-Gates~~ → Session 2: G1–G3 Logik, Conflict Detection, Auto-Confirm
- ~~Eval-Plan~~ → Session 1: 8 Eval-Suiten definiert
- ~~MVP-Reihenfolge~~ → Session 1: 8 Phasen
- ~~Bestehende Test-Failures~~ → PIC v1, nicht relevant für Neubau
- ~~Voice/Mikrofon~~ → Funktioniert in PIC v1

### Offen (Implementierung — getrackt in MVP-Phasen)
1. **Trust-/Taint-System** implementieren (Phase 1 + 4)
2. **Context Assembler** mit Budgets bauen (Phase 3)
3. **Dashboard** neu bauen (Phase 5+)

---

## 18. Inspirationsquellen

| Quelle | Übernommenes Muster |
|---|---|
| **MemGPT** | Memory-Tiers, Checkpoints, aktive Memory-Runtime |
| **Zep** | Temporale Fakten, Fakt-Invalidierung, Context Assembly |
| **OpenAI Cookbook** | Eval-driven Development, Structured Outputs, Prompt Caching, Governed Agents |
| **DeepSeek Docs** | Context Caching (Disk), Pricing, Thinking Mode |
| **OpenAI MCP/Connectors** | Referenzarchitektur für Remote MCP, `allowed_tools`, Approval-Patterns |

**Nichts 1:1 übernommen** — das Ziel ist ein Ozy-eigener Kern, der nur die besten Muster integriert.
