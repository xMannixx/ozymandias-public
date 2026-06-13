# Ozymandias — LLM-Provider Dokumentation

> Implementierung: `backend/app/services/llm/`  
> Router: `backend/app/services/llm/router.py`  
> Konfiguration: `docs/OZY_PROVIDER_CONFIG.md`

---

## Überblick

Ozymandias unterstützt fünf LLM-Provider, die je nach **Sensitivity** und **Intent** automatisch gewählt werden. Kein Provider ist fest verdrahtet — das Routing ist vollständig konfigurierbar.

### Provider-Übersicht

| Provider | Typ | Konfiguration | Standard-Use-Case |
|---|---|---|---|
| **DeepSeek** | Cloud API | `DEEPSEEK_API_KEY` | Work, Extraktion, Allgemein |
| **Gemini** | Cloud API | `GEMINI_API_KEY` | Kreativ, Unterhaltung |
| **OpenAI** | Cloud API | `OPENAI_API_KEY` | Tool-Calls, TTS, Whisper |
| **Ollama** | Lokal | `OLLAMA_BASE_URL` | S3/S4, Privacy, Offline |
| **LM Studio** | Lokal | `LMSTUDIO_MODEL` | S3/S4, Alternativ zu Ollama |

---

## Routing-Logik

### Sensitivity-basiertes Routing (oberste Priorität)

```python
if sensitivity in {S3, S4}:
    → Lokaler Provider (Ollama oder LM Studio)
    # Keine Cloud-Provider! Security-Invariante
```

S3/S4-Daten verlassen **niemals** das lokale System. Diese Regel ist in der `TurnService`-Logik vor dem Router kodiert:

```python
if payload_sensitivity in {S3, S4} and preferred_provider not in {"ollama", "lmstudio"}:
    preferred_provider = None  # Cloud-Override explizit geblockt
```

### Intent-basiertes Routing

```python
def _resolve_provider_name(intent: str, sensitivity: Sensitivity) -> str:
    if sensitivity in {S3, S4}: return local_provider
    if intent == "intimate_reflection": return local_provider
    if intent in {"tool_call", "critical_action"}: return "openai"
    if intent in {"creative", "talk"}: return "gemini"
    if intent == "claim_extraction": return "deepseek"
    return "deepseek"  # Default
```

### User-Override (mittlere Priorität)

Der Nutzer kann in den Einstellungen einen bevorzugten Provider setzen:

```json
{
  "preferred_provider": "deepseek",
  "preferred_model": "deepseek-chat",
  "preferred_local_provider": "ollama",
  "preferred_local_model": "llama3.1:8b"
}
```

Per Turn kann auch direkt überschrieben werden:

```json
POST /turns
{
  "text": "...",
  "provider": "gemini",
  "model": "gemini-2.0-flash"
}
```

Wichtig: User-Overrides können **nie** die S3/S4-Sicherheitsregel außer Kraft setzen.

### Fallback im Dev-Modus

```python
# Nur wenn AUTH_DEV_BYPASS=true
for candidate in ("deepseek", "openai", "gemini", "ollama", "lmstudio"):
    if candidate in configured_providers:
        return candidate
```

Im Produktionsmodus gibt es keinen Fallback — ein fehlender API-Key führt zu einem klaren Fehler.

---

## Provider-Details

### DeepSeek

```python
# backend/app/services/llm/deepseek.py
class DeepSeekProvider(LLMProvider):
    _base_url = "https://api.deepseek.com/v1"
    _default_model = "deepseek-chat"  # oder "deepseek-reasoner"
```

**Konfiguration:**
```env
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-chat        # Optional
```

**Besonderheiten:**
- `deepseek-reasoner` gibt `reasoning_content` zurück (Chain-of-Thought)
- Automatisches Disk-Caching: Stabile Prefixe (System-Prompt) werden gecacht
- Batch-API: 50% Rabatt für zeitunkritische Jobs (noch nicht integriert)
- Kontextfenster: 128K Tokens

**Standard-Use-Cases in Ozy:**
- `work` Intent (Strukturierte Arbeit, Akten, Extraktion)
- `claim_extraction` (Fakten aus Gespräch extrahieren)
- Default-Provider wenn nichts anderes passt

**Kosten-Richtwerte:**
- DeepSeek-Chat: $0.28/1M Input · $1.10/1M Output
- DeepSeek-Reasoner: $0.55/1M Input · $2.19/1M Output
- Cache-Hit: $0.07/1M (deutlich günstiger)

---

### Gemini

```python
# backend/app/services/llm/gemini.py
class GeminiProvider(LLMProvider):
    _base_url = "https://generativelanguage.googleapis.com/v1beta"
    _default_model = "gemini-2.0-flash"
```

**Konfiguration:**
```env
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.0-flash       # Optional
```

**Standard-Use-Cases:**
- `creative` Intent (kreative Texte, Ideen)
- `talk` Intent (freie Unterhaltung, stundenlange Konversation)

---

### OpenAI

```python
# backend/app/services/llm/openai_provider.py
class OpenAIProvider(LLMProvider):
    _base_url = "https://api.openai.com/v1"
    _default_model = "gpt-4o"
```

**Konfiguration:**
```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o                 # Optional
TTS_MODEL=tts-1                     # Für Voice-Synthese
TTS_VOICE=ash                       # ash | alloy | echo | fable | onyx | nova | shimmer
WHISPER_MODEL=whisper-1             # Für Sprach-Transkription
```

**Standard-Use-Cases:**
- `tool_call` Intent (höchste Verlässlichkeit bei strukturierten Outputs)
- `critical_action` Intent (wenn Fehler teuer sind)
- TTS: `/voice/synthesize`
- Whisper STT: `/voice/transcribe`

---

### Ollama (Lokal)

```python
# backend/app/services/llm/ollama.py
class OllamaProvider(LLMProvider):
    _base_url = "http://localhost:11434"  # Oder OLLAMA_BASE_URL
    _default_model = "llama3.1:8b"
```

**Konfiguration:**
```env
OLLAMA_BASE_URL=http://localhost:11434  # Optional
OLLAMA_MODEL=llama3.1:8b               # Optional
```

**Standard-Use-Cases:**
- S3/S4-Daten (keine Kosten, 100% Privacy)
- `intimate_reflection` Intent
- Offline-Betrieb
- Fallback wenn alle Cloud-Provider ausfallen

**Immer verfügbar:** Ollama ist der einzige Provider, der **immer** in `_providers` registriert ist — auch ohne API-Key. (Läuft lokal auf dem VPS.)

---

### LM Studio (Lokal)

```python
# backend/app/services/llm/lmstudio.py
class LMStudioProvider(LLMProvider):
    _base_url = "http://localhost:1234/v1"  # OpenAI-kompatible API
```

**Konfiguration:**
```env
LMSTUDIO_MODEL=mistral-7b-instruct  # Aktiviert LM Studio
LMSTUDIO_BASE_URL=http://localhost:1234/v1  # Optional
```

**Standard-Use-Cases:** Identisch mit Ollama — alternativ, wenn LM Studio statt Ollama läuft.

---

## LLMProvider-Interface

```python
# backend/app/services/llm/base.py

class LLMMessage(TypedDict):
    role: str       # "system" | "user" | "assistant"
    content: str

class LLMResponse(BaseModel):
    content: str
    provider: str
    model: str
    reasoning_content: str | None   # Nur DeepSeek-Reasoner
    tokens_used: int | None

class LLMProvider(ABC):
    @abstractmethod
    async def chat(
        self,
        messages: list[LLMMessage],
        *,
        tools: list[dict] | None = None,
        model: str | None = None,    # Modell-Override pro Request
    ) -> LLMResponse: ...
```

Alle Provider implementieren dasselbe Interface. Der Router kennt keine Provider-spezifischen Details.

---

## Claim-Extraktor

```python
# backend/app/services/llm/claim_extractor.py
class ClaimExtractor:
    async def extract(
        self,
        llm_response_text: str,
        original_message: str,
        sensitivity: Sensitivity,
        turn_id: str,
    ) -> list[ClaimData]: ...
```

Der Claim-Extraktor analysiert LLM-Response + Original-Nachricht und extrahiert strukturierte Fakten:

**Prompt-Strategie:**
1. System-Prompt definiert das Claim-JSON-Schema
2. Gibt `original_message` und `llm_response_text` als Kontext
3. Fragt: „Welche persistenten Fakten stecken in dieser Konversation?"

**Ergebnis:** Liste von `ClaimData`-Objekten mit vorläufigen Werten:
- `verification_state = tentative` (LLM-Inferenz)
- `source_type = model_inferred`
- `confidence` vom LLM geschätzt (max 0.9)
- `sensitivity` vom LLM eingeschätzt (kann durch G1 überschrieben werden)

---

## Context Assembler

```python
# backend/app/services/llm/context_assembler.py
class ContextAssembler:
    async def assemble(
        self,
        user_id: str,
        sensitivity: Sensitivity,
        provider_is_local: bool,
    ) -> str:  # Formatierter Context-Block
```

Baut den Memory-Block für den System-Prompt:

```
## Dein aktuelles Wissen über den Nutzer

### Prozedurale Regeln (immer aktiv):
- Immer duzen
- Mails auf Deutsch
- ...

### Aktuelle Fakten (Claims):
[CLAIM: alex:wohnort = Beispielstadt] (confirmed, S0)
[CLAIM: alex:beruf = Softwareentwicklung] (confirmed, S1)
...

### Gesprächskontext (Episoden):
...
```

**Token-Budget:**
- Rust: `allocate_token_budget()` bestimmt `max_claims` und `max_tokens_per_claim`
- Priorität: nach `last_accessed` + Projektverknüpfung
- Sensitivity-Filter: S4-Claims nur bei `intimate_reflection` + lokal

---

## Sensitivity Classifier

```python
# backend/app/services/llm/sensitivity_classifier.py
async def classify_sensitivity(text: str, channel: Channel) -> SensitivityClassification:
```

Klassifiziert die Sensitivity eines eingehenden Texts und liefert **Herkunft + Health** zurück (`SensitivityClassification(sensitivity, source, local_classifier_available)`):
- Zuerst deterministische Keyword-Listen (S4/S3) → `source="keyword"`
- `channel = system` / `celery` → `Sensitivity.S0`, `source="system_channel"`
- Unklare Fälle → lokaler LLM-Classifier (Ollama) → `source="local_llm"`
- **Lokaler Classifier nicht erreichbar:** degradiert nachvollziehbar zu `Sensitivity.S1`, `source="degraded"`, `local_classifier_available=False` — statt hart fail-closed auf S3. Deterministische S3/S4-Keyword-Treffer bleiben davon unberührt strikt lokal.

> Rückwärtskompatibilität: `normalize_classification()` akzeptiert weiterhin ein einfaches `Sensitivity` (z. B. aus Tests/Mocks).

---

## TTS und Whisper

### Text-to-Speech

```python
# backend/app/services/llm/tts.py
async def synthesize_speech(text: str, voice: str, model: str) -> bytes:
    """Gibt audio/mpeg-Bytes zurück. Direkt streambar."""
```

Verwendet OpenAI TTS API. Konfigurierbar über `user_settings`:
- `tts_voice`: `ash` | `alloy` | `echo` | `fable` | `onyx` | `nova` | `shimmer`
- `tts_model`: `tts-1` | `tts-1-hd`
- `tts_autoplay`: Frontend spielt Audio automatisch ab

### Speech-to-Text (Whisper)

```python
# backend/app/services/llm/whisper.py
async def transcribe_audio(file_bytes: bytes, filename: str) -> str:
    """Gibt transkribierten Text zurück."""
```

Akzeptiert: WAV, MP3, WebM, MP4, M4A, OGG (max 25 MB).

---

## Verfügbare Provider abfragen

```
GET /llm/providers

Response:
{
  "providers": ["deepseek", "gemini", "ollama"],
  "default_provider": "deepseek",
  "default_model": "deepseek-chat"
}
```
