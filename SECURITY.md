# Security Policy — Ozymandias

Ozymandias ist ein **Privacy-first, Fail-closed** System. Sicherheit ist kein nachträglicher Gedanke — sie ist in der Architektur verankert.

---

## Inhaltsverzeichnis

- [Sicherheitsgrenzen](#sicherheitsgrenzen)
- [Bekannte Sicherheitsarchitektur](#bekannte-sicherheitsarchitektur)
- [Sicherheitslücken melden](#sicherheitslücken-melden)
- [Reaktionszeiten](#reaktionszeiten)
- [Unterstützte Versionen](#unterstützte-versionen)
- [Sicherheitsrelevante Konfiguration](#sicherheitsrelevante-konfiguration)
- [Was ist kein Security-Bug](#was-ist-kein-security-bug)

---

## Sicherheitsgrenzen

Ozymandias behandelt folgende Bereiche als **sicherheitskritisch** — Fehler hier haben höchste Priorität:

### 1. Sensitivity-Routing (Rust-Kern)
**S4** (Intimsphäre) darf **unter keinen Umständen** an Cloud-Provider gesendet werden — kein Fallback, keine Ausnahme.
**S3** (Finanzen, Keys, Sicherheitsrelevantes) wird standardmäßig lokal verarbeitet (`enforce_local=true`). Ein Cloud-Fallback ist pro Turn nur möglich, wenn der Request explizit `allow_s3_cloud_fallback: true` setzt; diese Freigabe liegt beim Aufrufer und wird protokolliert.
Diese Grenze ist in `ozy-core/sensitivity_router.rs` implementiert und in `ozy-bindings` nach Python exponiert.

**Severity: KRITISCH**

### 2. Write-Gate-Pipeline (G1–G5)
Kein LLM darf direkt in die Datenbank schreiben. Jeder Memory-Schreibvorgang muss die 5 Write-Gates (Schema-Validierung → Source Provenance → Conflict Detection → Human-in-the-Loop → Append-Only Commit) durchlaufen.

**Severity: KRITISCH**

### 3. JWT-Authentifizierung
Alle API-Endpunkte (außer `/health` und `/auth/google/*`) erfordern ein gültiges JWT. Der `AUTH_DEV_BYPASS`-Mechanismus darf **niemals** in Produktionsumgebungen aktiviert sein.

**Severity: HOCH**

### 4. Audit-Trail-Integrität
Das `audit_log` ist append-only. Einträge dürfen nicht gelöscht, überschrieben oder rückwirkend verändert werden. Angriffe auf die Integrität des Audit-Trails (z.B. SQL-Injection zum Löschen von Logs) sind hochkritisch.

**Severity: HOCH**

### 5. Circuit Breaker
Der Redis-backed Circuit Breaker verhindert DDoS-artige API-Kosten-Loops. Ein Bypass des Circuit Breakers (z.B. durch Redis-Manipulation) ermöglicht potenziell unbegrenzte LLM-API-Kosten.

**Severity: MITTEL**

### 6. S4-Isolation
S4-Daten (Intimsphäre) müssen vollständig isoliert von anderen Systemen verarbeitet werden. S4-Inhalte dürfen nicht in Briefings, Heartbeats, normalen Recalls oder Logs auftauchen, die für nicht-S4-Kontexte sichtbar sind.

**Severity: KRITISCH** (Privacy)

---

## Bekannte Sicherheitsarchitektur

Diese Mechanismen sind absichtlich implementiert und gelten nicht als Bugs:

| Mechanismus | Beschreibung |
|---|---|
| **Taint-Tracking** | Untrusted-Quellen (T0/T1) kontaminieren den gesamten Turn — alle nachfolgenden Aktionen werden hochgestuft |
| **Context Tainting** | S3/S4-Claims im Kontext erhöhen die Approval-Klasse für alle Aktionen im selben Turn |
| **Fail-Closed-Routing** | S4: Immer Fehler, wenn kein lokaler Provider verfügbar ist. S3: Fehler, wenn kein lokaler Provider verfügbar ist und `allow_s3_cloud_fallback=false`; bei `allow_s3_cloud_fallback=true` wird auf einen Cloud-Provider gefallen |
| **Core Invariants** | Selbst-Änderungen (Autopilot deaktiviert seine eigene Aufsicht) sind hardcoded Klasse 4 — immer Human-in-the-Loop |
| **Payload-Sensitivity-Check** | Bevor ein Payload versendet wird (E-Mail, Upload, API-Call), wird seine Sensitivity geprüft — S4-Payload + Remote Write → explizite Warnung |

---

## Sicherheitslücken melden

**Bitte Sicherheitslücken NICHT als öffentliches GitHub Issue melden.**

Melde Sicherheitslücken direkt an den Repository-Owner über GitHub's Private Security Advisory:

1. Gehe zu `https://github.com/xMannixx/ozymandias-public/security/advisories/new`
2. Beschreibe die Lücke so detailliert wie möglich
3. Füge wenn möglich einen reproduzierbaren Test-Case bei

### Was in den Report gehört

- **Beschreibung**: Was ist das Problem?
- **Angriffsvektor**: Wie ist die Lücke ausnutzbar?
- **Betroffene Komponente**: Welches Modul/Datei/Endpunkt?
- **Auswirkung**: Was kann ein Angreifer damit erreichen?
- **Reproduzierbarkeit**: Schritte zum Reproduzieren
- **Vorgeschlagene Lösung** (optional, aber willkommen)

---

## Reaktionszeiten

| Severity | Reaktionszeit | Fix-Zeit |
|---|---|---|
| **KRITISCH** (S4-Leak, Auth-Bypass, Write-Gate-Bypass) | 24 Stunden | 72 Stunden |
| **HOCH** (JWT-Probleme, Audit-Trail-Integrität) | 48 Stunden | 1 Woche |
| **MITTEL** (Circuit Breaker, Info-Leak) | 1 Woche | 2 Wochen |
| **NIEDRIG** | Nach Ermessen | Nächster Release |

---

## Unterstützte Versionen

Da Ozymandias sich in aktiver Entwicklung befindet (Phase 1), gilt:

- **Aktuelle Entwicklungsversion** (`main`-Branch): Vollständig unterstützt
- **Ältere Commits**: Keine Sicherheits-Backports

---

## Sicherheitsrelevante Konfiguration

### Kritische Umgebungsvariablen

| Variable | Sicherheitsrelevanz |
|---|---|
| `JWT_SECRET` | **MUSS** ein starkes, zufälliges Secret sein (min. 32 Zeichen). Standardwert `change-me` ist für Produktion verboten. |
| `AUTH_DEV_BYPASS` | **MUSS** in Produktion `false` sein. `true` deaktiviert JWT-Prüfung vollständig. |
| `MINIO_SECRET_KEY` | Standard `pic_minio_secret_change_me` ist für Produktion verboten. |
| `POSTGRES_PASSWORD` | Standard `postgres` ist für Produktion verboten. |
| `GOOGLE_CLIENT_SECRET` | OAuth-Secret — niemals loggen oder exponieren. |

### Produktions-Checkliste

- [ ] `JWT_SECRET` auf zufälliges 64-Zeichen-Secret gesetzt
- [ ] `AUTH_DEV_BYPASS=false` (oder Variable nicht gesetzt)
- [ ] Alle Standard-Passwörter geändert (Postgres, MinIO)
- [ ] Nginx mit HTTPS/TLS konfiguriert (SSL-Terminierung)
- [ ] Postgres-Port `5432` nicht öffentlich erreichbar (nur internes Docker-Netz)
- [ ] Redis-Port `6379` nicht öffentlich erreichbar
- [ ] MinIO-Port `9000/9001` nicht öffentlich erreichbar
- [ ] Regelmäßige Backups aktiv (`pg-backup`-Container läuft)
- [ ] Audit-Log wird regelmäßig überprüft

---

## Was ist kein Security-Bug

Folgende Verhaltensweisen sind absichtlich und gelten nicht als Sicherheitslücken:

- **S4-Inhalte werden lokal ohne Guardrails verarbeitet**: Dies ist ein expliziter Design-Entscheid. Cloud-Provider blocken sexuellen Content; für S4 werden guardrail-freie lokale Modelle verwendet.
- **Circuit Breaker blockiert legitime Anfragen**: Der Circuit Breaker ist konservativ konfiguriert. Wenn 20 Aktionen/Minute zu wenig sind, ist das eine Konfigurationsfrage, kein Bug.
- **S4-Audit-Einträge sind standardmäßig im Dashboard nicht sichtbar**: Absichtliche gestufte Sichtbarkeit. S4-Einträge können mit explizitem Filter abgerufen werden.
- **`AUTH_DEV_BYPASS=true` erlaubt unauthentifizierten Zugriff**: Dev-only Feature. In Produktion deaktivieren.
