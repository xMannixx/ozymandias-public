# Ozymandias — Benutzerhandbuch & Administrator-Leitfaden

Willkommen bei Ozymandias (Ozy), deiner persönlichen, sicheren KI-Schaltzentrale. Dieses Handbuch erklärt dir die wichtigsten Konzepte, die alltägliche Bedienung und wie du Ozy ohne großen Aufwand einrichten kannst.

---

## Inhaltsverzeichnis
1. [Was ist Ozymandias?](#1-was-ist-ozymandias)
2. [Die Benutzeroberfläche](#2-die-benutzeroberfläche)
3. [Schritt-für-Schritt-Anleitungen](#3-schritt-für-schritt-anleitungen)
   - [Einen neuen Fakt (Claim) hinzufügen](#einen-neuen-fakt-claim-hinzufügen)
   - [Vorschläge (Proposals) bestätigen oder ablehnen](#vorschläge-proposals-bestätigen-oder-ablehnen)
   - [Konflikte im Gedächtnis lösen](#konflikte-im-gedächtnis-lösen)
   - [Verhaltensregeln (Rules) festlegen](#verhaltensregeln-rules-festlegen)
4. [Sicherheit & Datenschutz (S0–S4)](#4-sicherheit--datenschutz-s0s4)
5. [Einfaches Setup & Start (Bypass-Modus)](#5-einfaches-setup--start-bypass-modus)

---

## 1. Was ist Ozymandias?

Ozymandias ist kein einfacher Chatbot, sondern ein autonomer Assistent, der dein digitales Leben begleitet. Seine Besonderheit liegt darin, dass er ein **langfristiges Gedächtnis** besitzt und all deine Daten nach strengen Datenschutz- und Sicherheitsregeln verarbeitet.

### Das Gedächtnissystem (Memory Tiers)
Ozy merkt sich Informationen auf vier Ebenen:
- **Arbeitsgedächtnis:** Der Kontext des aktuellen Gesprächs (worüber ihr gerade redet).
- **Episodisches Gedächtnis:** Chronologische Aufzeichnungen vergangener Gespräche.
- **Semantisches Gedächtnis:** Strukturierte Fakten (sogenannte **Claims**), z. B. deine Hobbys, deine Familie oder wichtige Kontakte.
- **Prozedurales Gedächtnis:** Regeln, die festlegen, wie Ozy sich verhalten soll (z. B. "Schreibe E-Mails immer kurz und professionell").

---

## 2. Die Benutzeroberfläche

Die Oberfläche ist ruhig und dunkel gehalten (Glass-Design) und durchgehend englisch beschriftet. Sie gibt dir vollen Einblick in das Gedächtnis der KI und ermöglicht dir die Freigabe kritischer Aktionen.

### Wichtige Bereiche:
- **Chat:** Schreibe oder sprich (Voice STT/TTS) mit Ozy.
- **Gedächtnis (Memory Browser):** Suche und filtere alle Fakten, die Ozy über dich weiß.
- **Vorschläge (Proposals):** Alle Fakten, die Ozy aus deinen Gesprächen ableitet, landen hier als Vorschlag zur Freigabe.
- **Regeln (Rules):** Hier verwaltest du die Verhaltensweisen der KI.
- **Projekte (Projects):** Jedes Projekt ist ein eigener Arbeitsbereich mit eigenem Chat, Wissensdokumenten und eigenen Instruktionen. Was dort liegt, nimmt Ozy automatisch in den Kontext.
- **Kontakte (Contacts):** Dein Adressbuch. Nennst du im Chat einen Namen, eine Firma oder eine Rolle, zieht Ozy den passenden Eintrag heran. Kontakte, die du als privat markierst, verlassen dabei nie deinen Rechner.
- **Verbrauch (Usage):** Tokens, Kosten, Antwortzeiten und Fehler pro Zeitraum, aufgeschlüsselt nach Modell, Provider und Kanal.
- **Audit-Feed:** Ein chronologisches Protokoll aller Aktionen, die das System ausgeführt hat — auch der nächtlichen Aufräumjobs.

---

## 3. Schritt-für-Schritt-Anleitungen

### Einen neuen Fakt (Claim) hinzufügen

Es gibt zwei Wege, wie Fakten in Ozys Gedächtnis gelangen:

#### Methode A: Direktes Diktieren (User Explicit)
Wenn du möchtest, dass Ozy sich etwas dauerhaft merkt, sage es ihm einfach im Chat:
1. Schreibe im Chat: `"Merk dir bitte: Mein Hund heißt Bello und liebt Bananen."`
2. Ozy erkennt diesen Befehl und leitet ihn an das Speicher-System weiter.
3. Da es sich um eine explizite Anweisung von dir handelt, wird dieser Fakt **automatisch bestätigt** (Auto-Confirmed) und ist sofort im Gedächtnis aktiv.

#### Methode B: Abgeleiteter Vorschlag (Model Inferred)
Wenn du dich normal unterhältst, versucht Ozy im Hintergrund, wichtige Informationen zu extrahieren:
1. Du schreibst im Chat: `"Nächste Woche fahre ich in den Urlaub nach Italien."`
2. Ozy schlägt im Hintergrund ein neues *Proposal* vor: `Urlaubsort = Italien`.
3. Da es sich um eine Ableitung handelt, wird dieser Fakt nicht sofort gespeichert, sondern landet in deiner **Vorschlagsliste (Proposals)**. Er bleibt solange inaktiv, bis du ihn freigibst.

---

### Vorschläge (Proposals) bestätigen oder ablehnen

Um abgeleitete Vorschläge freizugeben:
1. Navigiere im Dashboard auf die Seite **Proposals** (Vorschläge).
2. Du siehst eine Liste mit ausstehenden Fakten, z. B. `[Italien] [Urlaubsort] [Italien]`.
3. Klicke auf **Bestätigen (Approve)**, um den Fakt dauerhaft zu speichern, oder auf **Ablehnen (Reject)**, um ihn zu verwerfen. Du kannst den Fakt vor der Bestätigung auch manuell bearbeiten (**Edit**).

---

### Konflikte im Gedächtnis lösen

Manchmal widersprechen sich Fakten. Wenn du Ozy erzählst: `"Ich wohne jetzt in Berlin"`, aber im Gedächtnis noch `"Wohnort = Hamburg"` hinterlegt ist, entsteht ein Konflikt.
1. Ozy erkennt den Widerspruch automatisch und erstellt eine **Conflict Group**.
2. Im Dashboard oder im Chat wirst du darauf hingewiesen, dass ein Konflikt vorliegt.
3. Auf der **Memory-Seite** kannst du den Konflikt einsehen.
4. Ozy löst Konflikte anhand der Vertrauenswürdigkeit der Quelle: Eine direkte Aussage von dir (`user_explicit`) überschreibt eine automatische Ableitung (`model_inferred`). Du kannst den veralteten Fakt manuell als **überholt (Superseded)** oder **gelöscht (Retracted)** markieren.

---

### Verhaltensregeln (Rules) festlegen

Du kannst steuern, wie Ozy arbeitet, indem du ihm Regeln gibst:
1. Gehe auf die Seite **Regeln**.
2. Erstelle eine neue Regel, z. B.:
   - **Bereich:** `Mail-Verhalten`
   - **Verhalten:** `"Entwürfe für E-Mails an Arbeitskollegen müssen immer formell geschrieben sein."`
3. Nach der Freigabe wendet Ozy diese Regel bei jedem E-Mail-Entwurf automatisch an.

---

## 4. Sicherheit & Datenschutz (S0–S4)

Ozymandias schützt deine Privatsphäre durch automatische Daten-Klassifizierung (Sensitivity Labels):

| Stufe | Kategorie | Datentypen | Verarbeitung |
|---|---|---|---|
| **S0 / S1** | Öffentlich / Intern | Allgemeine Gespräche, Hobbys, Wetter | Alle Provider (z. B. DeepSeek, Gemini, OpenAI) |
| **S2** | Vertraulich | Projektdetails, Terminkalender | Nur verifizierte, sichere Cloud-Provider |
| **S3** | Streng Geheim | Finanzen, Passwörter, Verträge | Nur auf lokalen Modellen (oder verschlüsselt) |
| **S4** | Intim | Sehr persönliche Gedanken, Beziehungen | **Nur lokal**, strikt isoliert im S4-Lockdown |

> [!WARNING]
> **Sicherheits-Routing:** Ozy routet Daten der Stufe S3 und S4 niemals unverschlüsselt an öffentliche Cloud-Modelle. Wenn kein lokales Modell (z. B. Ollama) läuft, werden diese Anfragen blockiert (Fail-Closed), anstatt deine Daten zu gefährden.

---

## 5. Einfaches Setup & Start (Docker-only)

Ozymandias läuft vollständig containerisiert. Du benötigst **keine lokale Installation** von Rust, Python 3.14 oder Node.js. Alle Komponenten (inklusive des in Rust geschriebenen Governance-Kerns) werden automatisch innerhalb der Docker-Container gebaut.

### Voraussetzungen:
- Docker Desktop (installiert und gestartet) oder Podman
- Git

### Installation unter Windows (Schnellstart):
1. Öffne ein Terminal im Ozymandias-Verzeichnis.
2. Führe das Skript `bootstrap.cmd` aus:
   ```cmd
   .\bootstrap.cmd
   ```
3. Das Skript fragt dich nach deinem gewünschten Modus:
   - **Option 1: Schnelle Evaluierung / Rust-Bypass** (Deaktiviert den Login-Screen und nutzt ein Python-Fallback, um den Start zu beschleunigen).
   - **Option 2: Vollständiger Entwickler-Build** (Kompiliert den echten, gehärteten Governance-Kern in Rust vollautomatisch innerhalb des Docker-Containers).
4. Das Skript erstellt automatisch eine funktionierende `.env`-Konfigurationsdatei und startet alle Container.
5. Sobald das System läuft, öffnet sich dein Webbrowser automatisch unter:
   `http://localhost:8080`

Du kannst nun direkt im Chat losschreiben!
