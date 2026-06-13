# Ozymandias — Frontend Dokumentation

> Tech-Stack: React 19 · TypeScript 6 · Vite 8 · Tailwind CSS 4  
> State: Zustand · React Router 7  
> Implementierung: `frontend/src/`  
> Design: NOC-Theme (dunkles Command-Center, Glassmorphism, Neon-Akzente)

---

## Überblick

Das Ozymandias-Frontend ist ein **dunkles, professionelles Command-Center-Dashboard** — kein bunter Consumer-Chat. Das Design folgt dem NOC-Paradigma (Network Operations Center): klare Informationsdichte, sofortiger Überblick, keine unnötige Ablenkung.

**Design-Tokens:**

| Token | Wert | Verwendung |
|---|---|---|
| Background | `#0d1117` | App-Hintergrund |
| Surface | `#161b22` | Cards, Panel |
| Surface-2 | `#21262d` | Input-Felder, Hover |
| Border | `#30363d` | Trennlinien |
| Neon-Blue | `#58a6ff` | Primär-Akzent, Guardian-Modus |
| Neon-Green | `#3fb950` | Erfolg, Online-Status |
| Neon-Orange | `#f0883e` | Autopilot-Modus, Warnings |
| Neon-Red | `#ff7b72` | Kill-Switch, Error, Danger |
| Text | `#c9d1d9` | Primärer Text |
| Text-Muted | `#8b949e` | Sekundärer Text, Labels |

**Modus-Indikator:**
- 🔵 Blau = Guardian (Human-in-the-Loop für alles)
- 🟠 Orange = Autopilot (automatisch mit Undo-Window)
- 🔴 Rot = Kill-Switch aktiv (alles geblockt)

---

## Seiten

### Dashboard (`/`)

**Datei:** `src/pages/DashboardPage.tsx`

Das Tages-Cockpit. Gibt einen sofortigen Überblick über:

- **Offene Proposals** — Wie viele Memory-Vorschläge warten auf Bestätigung?
- **Pending Conflicts** — Welche Widersprüche müssen aufgelöst werden?
- **System-Status** — Health-Check: DB, Redis, Rust-Bindings, LLM-Provider
- **Stats** — Anzahl Claims, Episoden, Audit-Einträge
- **Modus-Anzeige** — Guardian / Autopilot / Kill-Switch

```
┌─────────────────────────────────────────────────────┐
│  OZY — GUARDIAN MODE  ●                             │
├──────────────┬──────────────┬──────────────────────┤
│  3 Proposals │  1 Conflict  │  DB: ✓  Redis: ✓     │
│  pending     │  pending     │  LLM: deepseek ✓     │
├──────────────┴──────────────┴──────────────────────┤
│  1.247 Claims  ·  89 Episoden  ·  342 Audit-Log    │
└─────────────────────────────────────────────────────┘
```

---

### Chat (`/chat`)

**Datei:** `src/pages/ChatPage.tsx`

Die primäre Konversationsschnittstelle.

**Features:**
- **Text-Input** — Nachricht schreiben und senden
- **Voice-Input** — Push-to-Talk via Mikrofon (Whisper STT) wenn aktiviert
- **TTS-Playback** — Ozy-Antworten werden automatisch vorgelesen (wenn `tts_autoplay = true`)
- **Intent-Selector** — Optional: expliziter Intent (work, talk, creative, ...)
- **Provider-Override** — Für diesen Turn anderen Provider wählen
- **Turn-Feedback** — Zeigt welcher Provider genutzt wurde, Token-Count, extrahierte Claims
- **Claim-Preview** — Extrahierte Claims inline anzeigen, direkt approve/reject

**API-Calls:**
- `POST /turns` — Turn verarbeiten
- `POST /voice/transcribe` — Audio → Text
- `POST /voice/synthesize` — Text → Audio

---

### Memory (`/memory`)

**Datei:** `src/pages/MemoryPage.tsx`

Browser für das semantische Gedächtnis (Claims).

**Features:**
- **Filter** — Nach Subject, Sensitivity (S0–S4), Verification State, Memory Type
- **Search** — Freitext-Suche in Subject + Content
- **Claim-Detail** — Vollständige Felder, Versionshistorie, Audit-Trail
- **Aktionen pro Claim:**
  - ✅ Confirm (`PATCH /claims/{id}/confirm`)
  - ❌ Retract (`PATCH /claims/{id}/retract`)
  - 🔒 Lock (`PATCH /claims/{id}/lock`)
  - 🔓 Unlock (`PATCH /claims/{id}/unlock`)
  - 📊 Sensitivity ändern (`PATCH /claims/{id}/sensitivity`)
- **Versionshistorie** — Alle Versionen mit Hash-Chain (`GET /claims/{id}/versions`)
- **Conflict Groups** — Widersprüche als zusammengehörige Gruppe anzeigen
- **Behavioral Rules Review** (Memory v2) — `BehavioralRulesReview.tsx`: Guardian-Review für selbstgeschriebene Verhaltensregeln, zeigt pending/aktive Regeln und erkannte Konflikte (hart/weich), mit Freigabe/Ablehnung/Retire (`/memory/rules*`)

---

### Proposals (`/proposals`)

**Datei:** `src/pages/ProposalsPage.tsx`

Die **Memory-Inbox** — das wichtigste HITL-Interface.

Alle unbestätigten Memory-Vorschläge (LLM hat einen Fakt erkannt) erscheinen hier.

**Für jeden Proposal:**
- 📋 **Vollständige Preview** — Was genau soll gespeichert werden?
- ✅ **Approve** — Claim wird erstellt, Proposal → `confirmed`
- ❌ **Reject** — Proposal → `rejected`, optionale Begründung
- ✏️ **Edit** — Wert korrigieren vor Bestätigung (geplant)

**Filter:**
- Status: `pending` | `confirmed` | `rejected` | `auto_confirmed`

**ConflictGroups** — Wenn G3 einen Widerspruch erkannt hat, werden die betroffenen Proposals als Gruppe angezeigt. Nutzer sieht beide Versionen und entscheidet.

---

### Audit (`/audit`)

**Datei:** `src/pages/AuditPage.tsx`

Chronologischer Feed aller sicherheitsrelevanten Aktionen.

**Features:**
- **Filter** — Nach Event-Type, Result, Sensitivity, Zeitraum
- **S4-Toggle** — S4-Einträge standardmäßig ausgeblendet (extra Klick nötig)
- **Echtzeit** — Neues Event wird oben angezeigt
- **Payload-Detail** — Vollständige JSON-Payload pro Eintrag

**Event-Types im Feed:**
- `turn_processed` — KI-Antwort
- `memory_confirmed` / `memory_rejected` — Proposal-Entscheidung
- `action_blocked` — Write-Gate hat abgelehnt
- `circuit_breaker_tripped` — Velocity-Limit erreicht
- `sensitivity_violation` — S3/S4 sollte Cloud-Provider → geblockt
- `security_event` — Taint-Escalation, InvariantViolation

---

### Einstellungen (`/settings`)

**Datei:** `src/pages/SettingsPage.tsx`

Vollständige Nutzer-Konfiguration.

**Sektionen:**

#### Betriebsmodus
- **Guardian / Autopilot-Toggle** — Klarer Modus-Indikator, visueller Wechsel
- **Kill-Switch** — Notfall-Stop, alles einfrieren

#### Provider-Einstellungen
- Bevorzugter Cloud-Provider + Modell
- Bevorzugter lokaler Provider + Modell
- Live-Test: Verbindung prüfen
- Provider-/Live-Web-Health im Dashboard (`SystemHealth`): pro Provider Runtime-Status, Live-Web-Connector-Status

#### Live-Web
- Live-Web aktivieren/deaktivieren, Modus (`provider_native_first` | `connector_only` | `off`)
- S3-Standardbestätigung (`live_web_s3_confirmed_default`); S4 ist gesperrt

#### Memory-Decay
- `decay_interval_hours` — Wie oft der Decay-Job läuft
- `decay_confidence_threshold` — Ab welcher Confidence archivieren

#### Circuit Breaker
- `cb_max_actions_override` — Max Aktionen pro Zeitfenster
- `cb_window_seconds_override` — Zeitfensterlänge
- `cb_cooldown_seconds_override` — Cooldown-Dauer

#### Voice
- Voice-Modus aktivieren/deaktivieren
- TTS-Stimme wählen (ash, alloy, echo, fable, onyx, nova, shimmer)
- TTS-Autoplay ein/aus

**API:** `GET /settings`, `PUT /settings`

---

### Kalender (`/calendar`)

**Datei:** `src/pages/CalendarPage.tsx`

Integration mit Google Calendar.

**Features:**
- Wochenansicht mit echten Google Calendar Events
- Event-Erstellung über Ozy-Chat
- Google-Verbindungsstatus-Anzeige

**API:** `GET /calendar/events`, `POST /calendar/events`, `GET /auth/google/status`

---

### Mail (`/mail`)

**Datei:** `src/pages/MailPage.tsx`

Gmail-Integration.

**Features:**
- Inbox-Ansicht (letzte N Mails)
- Mail-Inhalt lesen
- Antworten/Erstellen über Ozy-Chat (geplant)

**API:** `GET /mail`

---

### Projekte (`/projects`)

**Datei:** `src/pages/ProjectsPage.tsx`

Projekt-Management mit Ozy-Integration.

**Features:**
- Projektliste mit Status (active/paused/completed/cancelled)
- Priorität (low/medium/high/critical) mit Farb-Coding
- Meilensteine, Tasks, Risiken, Notizen, Dateien, Links
- Projekt mit Ozy verknüpfen → Claims werden dem Projekt zugeordnet

**API:** Vollständiges CRUD `/projects` + Sub-Ressourcen

---

### Kontakte (`/contacts`)

**Datei:** `src/pages/ContactsPage.tsx`

CRM-artige Kontaktverwaltung.

**Features:**
- Kontaktliste mit Name, Firma, Rolle
- Kontakt-Detail: Telefon, E-Mail, Adresse, Geburtstag, Tags
- Avatar-Upload
- Verknüpfung mit Projekten

**API:** `GET /contacts`, `POST /contacts`

---

## State Management (Zustand-Stores)

### authStore (`src/store/authStore.ts`)

```typescript
interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  isDevBypass: boolean;     // AUTH_DEV_BYPASS=true → automatisch eingeloggt
  login: (token: string) => void;
  logout: () => void;
}
```

**Dev-Bypass:** Wenn `VITE_AUTH_BYPASS=true` (Build-Arg in `docker-compose.yaml`), wird automatisch ein Dev-Token gesetzt. Kein Login-Screen nötig.

### modeStore (`src/store/modeStore.ts`)

```typescript
interface ModeState {
  mode: "guardian" | "autopilot";
  killSwitch: boolean;
  setMode: (mode: "guardian" | "autopilot") => void;
  setKillSwitch: (active: boolean) => void;
}
```

Der Modus-Store spiegelt den Server-State aus `user_settings`. Änderungen werden sofort an `PUT /settings` propagiert.

---

## API-Client-Layer (`src/api/`)

Typisierter Fetch-Wrapper für alle Backend-Endpunkte.

```typescript
// Basis-Client mit Auth-Header
const client = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL || "http://localhost:8000",
  getToken: () => useAuthStore.getState().token,
});

// Typisierte Endpunkt-Funktionen
export const turns = {
  process: (request: TurnRequest): Promise<TurnResult> =>
    client.post("/turns", request),
};

export const claims = {
  list: (filters?: ClaimFilters): Promise<ClaimResponse[]> =>
    client.get("/claims", { params: filters }),
  confirm: (id: string): Promise<ClaimResponse> =>
    client.patch(`/claims/${id}/confirm`),
  retract: (id: string): Promise<ClaimResponse> =>
    client.patch(`/claims/${id}/retract`),
};

export const proposals = {
  list: (status?: ProposalStatus): Promise<ProposalResponse[]> =>
    client.get("/proposals", { params: { status } }),
  approve: (id: string): Promise<ProposalResponse> =>
    client.post(`/proposals/${id}/approve`),
  reject: (id: string, reason?: string): Promise<ProposalResponse> =>
    client.post(`/proposals/${id}/reject`, { reason }),
};

// ... alle weiteren Endpunkte analog
```

---

## Routing (React Router 7)

```typescript
// src/App.tsx (vereinfacht)
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<AuthGuard><AppShell /></AuthGuard>}>
    <Route path="/" element={<DashboardPage />} />
    <Route path="/chat" element={<ChatPage />} />
    <Route path="/memory" element={<MemoryPage />} />
    <Route path="/proposals" element={<ProposalsPage />} />
    <Route path="/audit" element={<AuditPage />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/calendar" element={<CalendarPage />} />
    <Route path="/mail" element={<MailPage />} />
    <Route path="/projects" element={<ProjectsPage />} />
    <Route path="/contacts" element={<ContactsPage />} />
  </Route>
</Routes>
```

**AuthGuard:** Wenn kein Token (und kein Dev-Bypass), Redirect zu `/login`.

**AppShell:** Sidebar-Navigation + Header mit Modus-Indikator.

---

## Build und Entwicklung

```bash
# Entwicklung
cd frontend
npm install
npm run dev          # Vite Dev-Server auf http://localhost:5173
npm run test         # Vitest Unit-Tests
npm run test:ui      # Vitest UI

# Produktion (Docker)
docker build --build-arg VITE_AUTH_BYPASS=false -t ozy-frontend .

# Umgebungsvariablen (frontend/.env.example)
VITE_API_URL=http://localhost:8000     # Backend-URL
VITE_AUTH_BYPASS=false                # Dev-Bypass (nur für Development)
```

---

## Geplante Features (Roadmap)

| Feature | Status |
|---|---|
| Memory-Graph (interaktiv, Claim-Beziehungen) | 🔜 Geplant |
| Token-Monitor (Kosten pro Turn live) | 🔜 Geplant |
| Swipe-Gesten für Approve/Reject | 🔜 Geplant |
| Undo-Timer nach Autopilot-Aktionen | 🔜 Geplant |
| PWA (Offline-Modus, installierbar) | 🔜 Geplant |
| Telegram-Web-App-Anbindung | 🔜 Geplant |
| Integration-Status-Dashboard | 🔜 Geplant |
| S4-gesicherte separate Inbox | 🔜 Geplant |
