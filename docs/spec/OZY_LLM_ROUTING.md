# OZY LLM-Routing — Technische Spezifikation

> Implementiert in: `backend/app/services/llm/router.py`  
> Sensitivity-Logik: `rust/ozy-core/src/sensitivity_router.rs`  
> Provider: `backend/app/services/llm/` (deepseek.py, gemini.py, openai_provider.py, ollama.py, lmstudio.py)  
> Konfiguration: `backend/app/config.py`, `.env`  
> Provider-Konfigurationsanleitung: `docs/OZY_PROVIDER_CONFIG.md`

---

## Überblick

Der LLM-Router ist die zentrale Weiche für alle KI-Anfragen im System. Er kombiniert zwei Entscheidungsebenen:

1. **Sensitivity-First**: S3/S4-Inhalte gehen **immer** zu lokalen Providern — keine Ausnahme
2. **Intent-Routing**: Für S0/S1/S2 wählt der Router basierend auf der Aufgabenklasse den optimalen Provider

**Fail-Closed:** Wenn kein passender Provider konfiguriert ist, wirft der Router einen Fehler — er fällt niemals auf einen unsicheren Provider zurück.

---

## Provider-Matrix

| Provider | Rolle | Sensitivity-Grenze | Konfiguration |
|---|---|---|---|
| **DeepSeek-V3** | Default / Work / Extraktion | S0–S2 | `DEEPSEEK_API_KEY` |
| **Gemini** | Talk / Kreativität | S0–S2 | `GEMINI_API_KEY` |
| **OpenAI GPT-4o** | Tool-Calls / Kritische Aktionen | S0–S2 | `OPENAI_API_KEY` |
| **Ollama** | Lokal / Privacy / S3–S4 | S0–S4 | `OLLAMA_BASE_URL` (immer verfügbar) |
| **LM Studio** | Lokal (Alternative zu Ollama) | S0–S4 | `LMSTUDIO_MODEL` (nur wenn gesetzt) |

**Claude ist kein konfigurierter Provider** — explizit ausgeschlossen (zu teuer, schlechtes Kosten/Nutzen-Verhältnis für dieses Projekt).

---

## Routing-Algorithmus

```python
def select_provider(intent, sensitivity, preferred_provider, preferred_local_provider):
    
    # 1. Sensitivity-Override: S3/S4 erzwingen lokalen Provider
    if sensitivity in {S3, S4}:
        local = _get_local_provider(preferred_local_provider)
        return providers[local]  # Fehler wenn nicht konfiguriert
    
    # 2. User-Preference: Nutzer hat explizit einen Provider gewählt
    if preferred_provider and preferred_provider in providers:
        return providers[preferred_provider]
    
    # 3. Intent-basiertes Routing
    name = _resolve_by_intent(intent, sensitivity)
    if name in providers:
        return providers[name]
    
    # 4. Dev-Fallback (nur wenn AUTH_DEV_BYPASS=true)
    if settings.auth_dev_bypass:
        for candidate in ["mistral", "deepseek", "openai", "anthropic",
                          "gemini", "openrouter", "ollama", "lmstudio"]:
            if candidate in providers: return providers[candidate]
    
    # 5. Fehler — kein unsicherer Fallback
    raise ServiceError(f"Provider '{name}' not configured")
```

### Intent → Provider Mapping

| Intent | Provider | Begründung |
|---|---|---|
| `tool_call` | OpenAI | Höchste Verlässlichkeit bei strukturierten Tool-Calls |
| `critical_action` | OpenAI | Wie tool_call |
| `creative` | Gemini | Kreativ, stundenlang gesprächig, kostenvertretbar |
| `talk` | Gemini | Wie creative |
| `claim_extraction` | DeepSeek | Günstig, gutes Strukturverständnis, 128K Kontext |
| `intimate_reflection` | Lokal (Ollama/LM Studio) | S4 — immer lokal, kein Cloud |
| *(Default)* | DeepSeek | Alle anderen Intents |

---

## Sensitivity-Routing (Rust-Kern)

Die eigentliche Sensitivity-Filterung (welche Claims an den Provider gegeben werden dürfen) ist in Rust implementiert:

```rust
// rust/ozy-core/src/sensitivity_router.rs::filter_claims()

S0, S1  → immer erlaubt
S2      → nur wenn provider_is_encrypted
S3      → nur wenn provider_is_local ODER provider_is_encrypted
S4      → nur wenn provider_is_local UND intent_type == "intimate_reflection"
```

**Zusätzlich:** `check_payload_sensitivity()` prüft ausgehende Payloads:

```
S4-Payload + Class3/4 (Remote Write) → Warning: "Du verschickst gerade S4-Content"
S4-Payload + Non-Local Channel      → Escalation auf Class4
S3-Payload + Non-Local Channel      → Escalation auf min. Class3
```

---

## Provider-Fallback-Logik

### Technische Ausfälle (erlaubt)

Wenn ein Provider temporär nicht erreichbar ist (Netzwerkfehler, API-Timeout), kann auf einen anderen Provider gefallen werden — **solange die Sensitivity-Grenze eingehalten wird**.

Beispiel: DeepSeek nicht erreichbar → Fallback auf Gemini (beide S0–S2).

Die Reihenfolge für S0–S2 lautet Mistral → DeepSeek → OpenAI → Anthropic → Gemini → OpenRouter → lokal. OpenRouter steht bewusst am Ende: als Broker erreicht er dieselben Anbieter, nur mit Aufschlag und einem Hop mehr.

### Safety-/Policy-Blocks (verboten)

Wenn ein Provider einen Request ablehnt, weil er gegen seine Content-Policy verstößt (z.B. OpenAI blockt S4-Content), darf **nicht blind** ein anderer Cloud-Provider versucht werden. Das würde die Privacy-Grenzen unterlaufen.

**Korrekte Behandlung:** ServiceError auslösen, Nutzer informieren, kein automatischer Retry mit anderem Provider.

### S3/S4 ohne lokalen Provider

Wenn S3/S4-Inhalte angefordert werden, aber kein lokaler Provider erreichbar/konfiguriert ist, wirft der Router einen **strukturierten** Fehler statt eines generischen `ServiceError`:

```python
raise LocalProviderUnavailableError(
    provider="ollama",
    sensitivity="S3",
    fallback_allowed=True,   # nur für S3 (mit Bestätigung), nie für S4
    detail="...",
)
```

Die API übersetzt das in **HTTP 503** mit `code="local_provider_unavailable"`. Dies bleibt ein **harter Fehler** für die lokal-pflichtige Verarbeitung — das System verarbeitet S3/S4 lieber gar nicht als mit einem Cloud-Provider. Der Router kennt dafür einen `enforce_local`-Schalter (Default `True`); nur bei explizit bestätigtem S3-Cloud-Fallback (`allow_s3_cloud_fallback`) darf er gelockert werden, niemals für S4.

---

## Modell-Overrides

Neben dem Provider-Routing können auch spezifische Modelle überschrieben werden:

```python
# Per User-Settings
preferred_provider: str   # z.B. "deepseek" | "openai" | "gemini" | "openrouter"
preferred_model: str      # z.B. "deepseek-v4-flash" | "gpt-4o" | "~openai/gpt-latest"
preferred_local_provider: str  # z.B. "ollama" | "lmstudio"
preferred_local_model: str     # z.B. "llama3.1:8b" | "mistral-7b"

# Per Turn-Request (temporärer Override für einen Turn)
# Wird über TurnRequest.preferred_provider etc. übergeben
```

**Priorität:** User-Settings > Default-Konfiguration  
**Einschränkung:** Sensitivity-Grenzen werden durch User-Overrides **nicht** aufgehoben. Ein User kann nicht einstellen, dass S4 zu OpenAI geht.

---

## LLMMessage und LLMResponse

Alle Provider normalisieren auf dasselbe Interface:

```python
class LLMMessage(TypedDict):
    role: Literal["system", "user", "assistant", "tool"]
    content: str

@dataclass
class LLMResponse:
    content: str        # Antwort-Text
    model: str          # Welches Modell geantwortet hat
    provider: str       # Provider-Name
    tokens_used: int    # Verbrauchte Tokens
    raw_response: dict  # Provider-spezifische Rohdaten (für Debugging)
    reasoning_content: str | None  # DeepSeek Thinking-Mode Output
```

`tokens_used` wird für das Dashboard-Kosten-Tracking verwendet (Cent-Anzeige nach jedem Turn).

---

## Kosten-Tracking

Nach jedem Turn wird `tokens_used` aus der `LLMResponse` für die Kostenberechnung verwendet:

| Provider | Input-Preis | Output-Preis |
|---|---|---|
| DeepSeek-V3 | $0.28 / 1M Tokens | $0.42 / 1M Tokens |
| DeepSeek (Cache-Hit) | $0.028 / 1M Tokens | — |
| Gemini (Flash) | ~$0.075 / 1M Tokens | ~$0.30 / 1M Tokens |
| OpenAI GPT-4o | $2.50 / 1M Tokens | $10.00 / 1M Tokens |
| Ollama/LM Studio | $0.00 | $0.00 |

**Prompt Caching:** DeepSeek hat automatisches Disk-Caching. Stabile Prefixe (System-Prompt, Tool-Definitionen) werden gecacht → 10× billiger bei Cache-Hit. Daher: System-Prompt und Tool-Definitionen **niemals** dynamisch generieren — sie müssen bei identischen Anfragen byte-identisch sein.

---

## Health-Check

Der `/health`-Endpunkt meldet alle konfigurierten Provider:

```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "rust_bindings": "ok",
  "llm_providers": ["deepseek", "ollama"],
  "llm_provider_health": [
    { "name": "ollama", "is_local": true, "configured": true, "status": "ok", "model": "llama3.1:8b" }
  ],
  "live_web": { "connector_status": "not_configured", "native_provider_candidates": ["openai"] }
}
```

Neben der reinen Liste `llm_providers` liefert `/health` pro Provider einen **Runtime-Status** (`llm_provider_health`): lokale Provider (Ollama/LM Studio) werden aktiv geprobt (`ok` | `unavailable`), Cloud-Provider als `configured` / `not_configured` gemeldet. `live_web` zeigt den Connector-Status und mögliche provider-native Kandidaten. Wenn `llm_providers` leer ist, ist kein Provider konfiguriert — das System funktioniert zwar (Dev-Modus), aber kann keine LLM-Anfragen verarbeiten.

---

## Live-Web

> Implementierung: `backend/app/services/live_web_service.py`, Verdrahtung in `backend/app/services/turn_service.py`

Optionaler Web-Zugriff während eines Turns, gesteuert über User-Settings (`live_web_enabled`, `live_web_mode`, `live_web_s3_confirmed_default`) und/oder pro Turn (`use_live_web`, `allow_s3_live_web`):

| Modus | Verhalten |
|---|---|
| `provider_native_first` | Bevorzugt native Web-Fähigkeit des Providers, sonst Connector |
| `connector_only` | Immer über den konfigurierten Connector (`LIVE_WEB_CONNECTOR_URL` + `_API_KEY`) |
| `off` | Kein Live-Web |

Sensitivity-Grenzen: **S0–S2** erlaubt, **S3** nur nach expliziter Bestätigung (sonst `LiveWebPermissionRequiredError` → HTTP 409, `code="live_web_confirmation_required"`), **S4** gesperrt (`live_web_blocked_for_s4`).

---

## Bekannte Einschränkungen

- **Kein Streaming**: Alle Provider-Responses sind blockierend. Streaming ist für spätere Phasen geplant (besonders für Chat-UI)
- **Kein automatischer Retry bei Ratelimits**: Muss noch implementiert werden
- **Batch-API**: DeepSeek Batch-API ist noch nicht integriert (geplant für Phase 7)
- **Lokales Modell-Routing**: Es gibt aktuell nur eine lokale Provider-Priorität (Ollama vor LM Studio). Kein Load-Balancing zwischen mehreren lokalen Instanzen
