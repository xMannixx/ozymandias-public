# OZY Provider-Konfiguration

> Konfiguriert in: `backend/app/config.py`, `.env`  
> Router-Implementierung: `backend/app/services/llm/router.py`  
> Routing-Logik: `docs/OZY_LLM_ROUTING.md`

---

## Überblick

Alle LLM-Provider werden über Umgebungsvariablen in der `.env`-Datei konfiguriert. Provider ohne gesetzten API-Key sind beim Start nicht verfügbar.

**Faustregel:**
- `DEEPSEEK_API_KEY` → Arbeitstier (günstig, 1M Kontext)
- `OLLAMA_BASE_URL` → Immer verfügbar (lokal, kein Key nötig), **Pflicht für S3/S4**
- `OPENAI_API_KEY` → Für Tool-Calls, Whisper STT, TTS
- `GEMINI_API_KEY` → Für Gespräche, Kreatives
- `OPENROUTER_API_KEY` → Für Modelle ohne eigenen Client
- `LMSTUDIO_MODEL` → Alternative zu Ollama

---

## DeepSeek

**Rolle:** Default / Work / Claim-Extraktion  
**Sensitivity:** S0–S2 (kein S3/S4)  
**Kosten:** $0.22/1M Input, $0.66/1M Output (Cache-Miss) | $0.007/1M (Cache-Hit), jeweils Off-Peak

### Konfiguration

```env
DEEPSEEK_API_KEY=<DEEPSEEK_API_KEY>
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-v4-flash
```

### API-Key erhalten

1. Gehe zu [platform.deepseek.com](https://platform.deepseek.com)
2. Account erstellen / einloggen
3. API-Keys → Neuen Key erstellen
4. Key beginnt mit `sk-`

### Modell-Optionen

| Modell | Kontext | Verwendung |
|---|---|---|
| `deepseek-v4-flash` | 1M | Standard, Work, Extraktion |
| `deepseek-v4-pro` | 1M | Für komplexe Reasoning-Aufgaben (3× teurer) |

`deepseek-chat` und `deepseek-reasoner` existieren seit dem 24.07.2026 nicht mehr; Aufrufe mit diesen Namen schlagen fehl. Thinking wird auf V4 pro Request gesteuert.

### Peak-Pricing

Seit dem 16.08.2026 kostet DeepSeek zwischen 01:00–04:00 und 06:00–10:00 UTC das Doppelte. Die Kostenberechnung in `pricing.py` berücksichtigt das automatisch anhand des Aufrufzeitpunkts.

### Prompt-Caching

DeepSeek hat automatisches Disk-Caching. Der System-Prompt und Tool-Definitionen werden gecacht, wenn sie byte-identisch sind (10× billiger). Aus diesem Grund werden System-Prompt und Tool-Definitionen in Ozymandias **nicht** dynamisch generiert.

---

## OpenAI

**Rolle:** Tool-Calls, kritische Aktionen, Whisper STT, TTS  
**Sensitivity:** S0–S2 (kein S3/S4)  
**Kosten:** GPT-4o: $2.50/1M Input, $10.00/1M Output

### Konfiguration

```env
OPENAI_API_KEY=<OPENAI_API_KEY>
OPENAI_MODEL=gpt-4o

# Whisper (Speech-to-Text)
WHISPER_MODEL=whisper-1

# TTS (Text-to-Speech)
TTS_MODEL=tts-1
TTS_VOICE=alloy
```

### API-Key erhalten

1. Gehe zu [platform.openai.com](https://platform.openai.com)
2. API Keys → New secret key
3. Key beginnt mit `sk-proj-` (neueres Format) oder `sk-`

### TTS-Voice-Optionen

| Voice | Charakteristik |
|---|---|
| `alloy` | Neutral, ausgewogen |
| `ash` | Klar, professionell (Standard in Settings) |
| `echo` | Männlich, warm |
| `fable` | Erzählerisch |
| `nova` | Weiblich, angenehm |
| `onyx` | Tief, autoritär |
| `shimmer` | Sanft, freundlich |

### Modell-Optionen

| Modell | Verwendung |
|---|---|
| `gpt-4o` | Standard, Tool-Calls |
| `gpt-4o-mini` | Günstiger, einfachere Tasks |
| `gpt-4-turbo` | Alternativ |

---

## Gemini

**Rolle:** Talk, Kreativität, lange Gespräche  
**Sensitivity:** S0–S2 (kein S3/S4)  
**Kosten:** Gemini Flash: ~$0.075/1M Input, $0.30/1M Output

### Konfiguration

```env
GEMINI_API_KEY=<GEMINI_API_KEY>
GEMINI_MODEL=gemini-2.0-flash
```

### API-Key erhalten

1. Gehe zu [aistudio.google.com](https://aistudio.google.com)
2. „Get API key" → Neuen Key erstellen
3. Key beginnt mit `AIzaSy`

### Modell-Optionen

| Modell | Kontext | Verwendung |
|---|---|---|
| `gemini-2.0-flash` | 1M | Standard, schnell, günstig |
| `gemini-2.5-pro` | 1M | Komplex, teurer |
| `gemini-1.5-pro` | 2M | Sehr langer Kontext |

---

## OpenRouter

**Rolle:** Broker für Modelle, für die Ozymandias keinen eigenen Client hat  
**Sensitivity:** S0–S2 (kein S3/S4)  
**Kosten:** pro Modell unterschiedlich; solche Calls bleiben in der Usage-Auswertung unbepreist

### Konfiguration

```env
OPENROUTER_API_KEY=<OPENROUTER_API_KEY>
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=~openai/gpt-mini-latest
```

### API-Key erhalten

1. Gehe zu [openrouter.ai/keys](https://openrouter.ai/keys)
2. Account erstellen / einloggen
3. „Create key" → Guthaben aufladen
4. Key beginnt mit `sk-or-v1-`

### Modell-Optionen

Mehrere hundert. Die Auswahl in den Einstellungen lädt den Katalog live von
`GET /llm/openrouter/models` und bietet ein Suchfeld; die Liste wird 15 Minuten
gecacht.

Slugs mit `~` sind rollende Aliase und zeigen immer auf die aktuelle Version:

| Slug | Bedeutung |
|---|---|
| `~openai/gpt-mini-latest` | aktuelles kleines OpenAI-Modell (Default) |
| `~anthropic/claude-sonnet-latest` | aktuelles Claude Sonnet |
| `~google/gemini-flash-latest` | aktuelles Gemini Flash |
| `~deepseek/deepseek-v4-flash-latest` | aktuelles DeepSeek Flash |

OpenRouter steht zuletzt in der Cloud-Fallback-Kette: der direkte Weg zum Anbieter ist günstiger und kürzer.

---

## Ollama (Lokaler Provider)

**Rolle:** S3/S4-Pflichtpfad, Privacy, Offline, guardrail-freie S4-Verarbeitung  
**Sensitivity:** S0–S4 (alle erlaubt)  
**Kosten:** $0.00

Ollama muss **separat installiert** werden — es läuft auf dem Host-System, nicht in Docker.

### Installation

```bash
# Linux/Mac
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# https://ollama.com/download/windows
```

### Konfiguration

```env
# Docker: Backend greift auf Host-System zu
OLLAMA_BASE_URL=http://host.docker.internal:11434

# Lokal (ohne Docker)
OLLAMA_BASE_URL=http://localhost:11434

OLLAMA_MODEL=llama3.1:8b
```

### Modell laden

```bash
# Modell herunterladen (einmalig)
ollama pull llama3.1:8b          # ~4.7 GB (Standard)
ollama pull llama3.1:70b         # ~40 GB (bessere Qualität, mehr RAM nötig)
ollama pull mistral:7b           # ~4.1 GB (Alternative)
ollama pull phi3:medium          # ~7.9 GB (Microsoft, gut für Reasoning)

# Für S4 (guardrail-freies Modell):
ollama pull llama3.1:8b         # Llama 3.1 hat vergleichsweise wenig Guardrails
# oder
ollama pull dolphin-mistral:7b   # Guardrail-freie Version

# Verfügbare Modelle anzeigen
ollama list

# Ollama-Status prüfen
curl http://localhost:11434/api/tags
```

### RAM-Anforderungen

| Modell | Mindest-RAM | Empfohlen |
|---|---|---|
| 7B Parameter | 8 GB | 16 GB |
| 13B Parameter | 16 GB | 32 GB |
| 70B Parameter | 40 GB | 80 GB |

**S4-Empfehlung:** Ein 7B-8B Modell ohne Guardrails ist für S4-Verarbeitung ausreichend. Größere Modelle bieten bessere Qualität, brauchen aber mehr RAM.

---

## LM Studio (Alternativer Lokaler Provider)

**Rolle:** Alternative zu Ollama, GUI-basiert  
**Sensitivity:** S0–S4 (alle erlaubt)  
**Kosten:** $0.00

### Konfiguration

```env
LMSTUDIO_BASE_URL=http://host.docker.internal:1234/v1
LMSTUDIO_MODEL=bartowski/Meta-Llama-3.1-8B-Instruct-GGUF
```

**Wichtig:** Wenn `LMSTUDIO_MODEL` leer ist (`""`), wird LM Studio nicht als Provider registriert.

### Setup

1. LM Studio herunterladen: [lmstudio.ai](https://lmstudio.ai)
2. Modell herunterladen (im LM Studio GUI)
3. Local Server starten (Port 1234)
4. Modell-Identifier aus LM Studio kopieren und in `LMSTUDIO_MODEL` setzen

---

## Google OAuth (Gmail + Calendar)

**Rolle:** Connector für Gmail-Lesen und Google Calendar  
**Nicht LLM** — aber OAuth-Konfiguration notwendig

### Google Cloud Console Setup

1. Gehe zu [console.cloud.google.com](https://console.cloud.google.com)
2. Neues Projekt erstellen (oder bestehendes wählen)
3. „APIs & Services" → „Bibliothek"
4. **Gmail API** aktivieren
5. **Google Calendar API** aktivieren
6. „OAuth-Zustimmungsbildschirm" konfigurieren:
   - Benutzertyp: Extern (oder Intern für Workspace)
   - App-Name: „Ozymandias"
   - Scopes: `gmail.readonly`, `calendar`
7. „Anmeldedaten" → „OAuth-Client-ID erstellen"
   - Typ: Webanwendung
   - Autorisierte Weiterleitungs-URIs: `http://localhost:8000/auth/google/callback` (Dev) / `https://deine-domain.tld/auth/google/callback` (Prod)
8. Client-ID und Client-Secret kopieren

### Konfiguration

```env
GOOGLE_CLIENT_ID=1234567890-xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<GOOGLE_CLIENT_SECRET>
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
OWNER_EMAIL=deine@gmail.com
```

### OAuth-Flow

1. Frontend: Button „Google verbinden" in Einstellungen
2. Backend: `GET /auth/google/url` → Erzeugt Auth-URL + CSRF-State (Redis, TTL: 5 Min.)
3. Browser: Redirect zu Google
4. Google: Nutzer stimmt zu
5. Google: Redirect zu `/auth/google/callback?code=xxx&state=xxx`
6. Backend: State verifizieren, Code gegen Tokens tauschen, Tokens in `google_tokens`-Tabelle speichern
7. Redirect zu `http://localhost:8080/settings?google=connected`

---

## Alle Provider auf einmal prüfen

```bash
# Health-Endpunkt zeigt konfigurierte Provider
curl http://localhost:8080/health | python3 -m json.tool

# Erwartete Ausgabe bei vollständiger Konfiguration:
# "llm_providers": ["deepseek", "openai", "gemini", "mistral", "anthropic", "openrouter", "ollama"]
```

---

## Minimalkonfiguration für S3/S4

Für die Verarbeitung von S3/S4-Daten (Pflicht für Privacy-Kernfunktionalität) braucht man mindestens:

```env
# Minimal: Nur lokaler Provider
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.1:8b
JWT_SECRET=<STRONG_RANDOM_JWT_SECRET>
```

Mit dieser Minimalkonfiguration funktioniert der System-Core, aber keine Cloud-LLM-Features (keine Claim-Extraktion via DeepSeek, kein Gemini-Talk, keine OpenAI-Tool-Calls).

---

## Empfohlene Produktionskonfiguration

```env
# Primäre Cloud-Provider
DEEPSEEK_API_KEY=sk-xxx        # Work, Extraktion (günstig)
OPENAI_API_KEY=sk-xxx          # Tool-Calls, Whisper, TTS
GEMINI_API_KEY=AIzaSy-xxx      # Talk, Kreativ
OPENROUTER_API_KEY=sk-or-v1-xxx  # Optional: alles, was sonst fehlt

# Lokaler Provider (Pflicht für S3/S4)
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.1:8b

# Google Connector (optional)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
OWNER_EMAIL=xxx@gmail.com
```

---

## Live-Web-Connector (optional)

Für Web-Zugriff im Modus `connector_only` bzw. als Fallback bei `provider_native_first`:

```env
LIVE_WEB_CONNECTOR_URL=https://api.tavily.com/search   # Standard
LIVE_WEB_CONNECTOR_API_KEY=tvly-xxx                    # leer = Connector deaktiviert
LIVE_WEB_CONNECTOR_TIMEOUT_SECONDS=8.0                 # 1.0–30.0
```

Ohne gesetzten Key meldet `/health` `live_web.connector_status = "not_configured"`. Provider-native Websuche (z. B. OpenAI/DeepSeek) funktioniert unabhängig davon. Sensitivity-Grenzen: S0–S2 erlaubt, S3 nur mit Bestätigung, S4 gesperrt.
