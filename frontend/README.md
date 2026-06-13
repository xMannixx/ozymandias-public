# Ozymandias Frontend

React + TypeScript Dashboard für den Ozymandias KI-Assistenten. Dunkles NOC-Theme, PWA-tauglich, Command-Center-Ästhetik.

---

## Tech Stack

| Technologie | Version | Verwendung |
|---|---|---|
| React | 19.2.4 | UI-Framework |
| TypeScript | 6.0.2 | Typsicherheit |
| Vite | 8.0.3 | Build-Tool, Dev-Server |
| Tailwind CSS | 4.2.2 | Styling |
| React Router | 7.0.0 | Client-Side Routing |
| Recharts | 3.x | Statistik-Charts |
| DOMPurify | 3.x | XSS-Schutz für HTML-Content |
| Vitest | 3.x | Unit-Tests |

---

## Schnellstart

```bash
# Dependencies installieren
npm install

# Dev-Server starten (Vite + HMR)
npm run dev
# → http://localhost:5173

# Typen prüfen
npm run typecheck

# Tests ausführen
npm run test

# Produktions-Build
npm run build
```

> **Hinweis:** Der Dev-Server proxyt API-Anfragen automatisch an `http://localhost:8000`. Das Backend muss lokal laufen oder über Docker erreichbar sein.

---

## Projektstruktur

```
frontend/
├── src/
│   ├── api/              # API-Client-Layer (alle Endpunkte)
│   │   ├── client.ts     # Basis-HTTP-Client mit Auth-Header
│   │   ├── turns.ts      # /turns Endpunkt
│   │   ├── claims.ts     # /claims Endpunkte
│   │   ├── proposals.ts  # /proposals Endpunkte
│   │   ├── audit.ts      # /audit Endpunkt
│   │   ├── settings.ts   # /settings Endpunkte
│   │   ├── projects.ts   # /projects Endpunkte
│   │   ├── contacts.ts   # /contacts Endpunkte
│   │   ├── mail.ts       # /mail Endpunkt
│   │   ├── calendar.ts   # /calendar Endpunkte
│   │   ├── voice.ts      # /voice Endpunkte
│   │   ├── llm.ts        # /llm Endpunkte
│   │   ├── stats.ts      # /stats Endpunkt
│   │   ├── health.ts     # /health Endpunkt
│   │   ├── files.ts      # /files Endpunkte
│   │   └── types.ts      # Gemeinsame API-Typen
│   │
│   ├── components/       # Wiederverwendbare Komponenten
│   │   ├── auth/         # AuthGuard, Login-Komponenten
│   │   ├── layout/       # AppShell, Sidebar, Navigation
│   │   ├── chat/         # Chat-Interface, Nachrichten
│   │   ├── memory/       # Memory-Browser, Claim-Cards
│   │   ├── proposals/    # Proposal-Inbox, Approve/Reject
│   │   ├── audit/        # Audit-Feed, Event-Items
│   │   ├── dashboard/    # Dashboard-Widgets, Statistiken
│   │   ├── calendar/     # Kalender-Ansicht, Event-Items
│   │   ├── mail/         # Mail-Inbox, Mail-Ansicht
│   │   ├── projects/     # Projekt-Karten, Tasks, Risiken
│   │   ├── contacts/     # Kontakt-Liste, Kontakt-Karte
│   │   ├── settings/     # Settings-Formulare
│   │   └── common/       # Allgemeine Komponenten (Button, Modal, etc.)
│   │
│   ├── pages/            # Seiten (Komposition aus Komponenten)
│   │   ├── ChatPage.tsx
│   │   ├── MemoryPage.tsx
│   │   ├── ProposalsPage.tsx
│   │   ├── AuditPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── CalendarPage.tsx
│   │   ├── MailPage.tsx
│   │   ├── ProjectsPage.tsx
│   │   ├── ContactsPage.tsx
│   │   └── LoginPage.tsx
│   │
│   ├── store/            # Zustand-Stores
│   │   ├── auth.ts       # JWT-Token, Login/Logout, Dev-Bypass
│   │   └── mode.ts       # Guardian/Autopilot-Modus
│   │
│   ├── hooks/            # Custom React Hooks
│   ├── constants/        # Konfigurationskonstanten
│   ├── App.tsx           # Routing-Konfiguration
│   ├── main.tsx          # React-Root, App-Bootstrap
│   └── index.css         # Globale Styles, Tailwind-Direktiven
│
├── public/               # Statische Assets
├── index.html            # HTML-Entry-Point
├── vite.config.ts        # Vite-Konfiguration (Dev-Proxy, Aliases)
├── tsconfig.json         # TypeScript-Konfiguration (strict mode)
├── vitest.config.ts      # Test-Konfiguration
└── package.json          # Dependencies
```

---

## Routing

| Pfad | Seite | Beschreibung |
|---|---|---|
| `/` | ChatPage | Hauptchat (Standard-Landing-Page) |
| `/memory` | MemoryPage | Memory-Browser: Claims, Filter, Confirm/Reject |
| `/proposals` | ProposalsPage | Proposal-Inbox |
| `/audit` | AuditPage | Audit-Trail-Feed |
| `/dashboard` | DashboardPage | Tages-Cockpit, Statistiken |
| `/settings` | SettingsPage | Guardian/Autopilot, Provider, Decay, Voice |
| `/calendar` | CalendarPage | Google Calendar Ansicht |
| `/mail` | MailPage | Gmail-Inbox |
| `/projects` | ProjectsPage | Projektverwaltung |
| `/contacts` | ContactsPage | Kontaktverwaltung |
| `/login` | LoginPage | Login (nur im JWT-Modus relevant) |

**Auth-Guard:** Alle Routen außer `/login` sind durch `AuthGuard` geschützt. Ohne gültiges JWT oder Dev-Bypass-Token wird zu `/login` redirected.

---

## State Management

### `auth.ts` Store

```typescript
// Zustand: JWT-Token verwalten
{
  token: string | null;
  userId: string | null;
  isDevBypass: boolean;
  login(token: string): void;
  logout(): void;
}
```

**Dev-Bypass:** Wenn `VITE_AUTH_BYPASS=true` (Build-Arg), wird ein fixer Dev-Token ohne Backend-Validierung gesetzt.

### `mode.ts` Store

```typescript
// Guardian/Autopilot-Modus
{
  mode: "guardian" | "autopilot";
  killSwitch: boolean;
  setMode(mode: string): void;
  setKillSwitch(active: boolean): void;
}
```

**Modus-Indikator im UI:**
- 🔵 Blau = Guardian (HITL für alles)
- 🟠 Orange = Autopilot (automatisch mit Undo-Window)
- 🔴 Rot = Kill-Switch aktiv (alle Aktionen blockiert)

---

## API-Client

Alle API-Aufrufe gehen ausschließlich über `src/api/`. Kein direktes `fetch()` in Komponenten oder Pages.

```typescript
// src/api/client.ts — Basis-Client
const API_BASE = "";  // Leer: Dev-Proxy via Vite, Prod: Nginx

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthStore().token;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!response.ok) throw new ApiError(response.status, await response.text());
  return response.json();
}
```

---

## Design-System (NOC-Theme)

**Farben:**
- Background: `#0d1117` (dark base)
- Card-Background: `rgba(13, 17, 23, 0.8)` + `backdrop-blur`
- Akzentfarbe: `#58a6ff` (Blau)
- Gefahr: `#f85149` (Rot)
- Erfolg: `#3fb950` (Grün)
- Warnung: `#d29922` (Orange)

**Typographie:**
- Font: System-Font-Stack (keine externe Font-Abhängigkeit)
- Code/Monospace: `JetBrains Mono` / System-Monospace

**Komponenten-Stil:**
- Glassmorphism: `backdrop-blur-md bg-white/5 border border-white/10`
- Bento-Grid-Layout für Dashboard
- Keine hellen Themes — ausschließlich Dark-Mode

---

## Tests

```bash
# Alle Tests ausführen
npm run test

# Tests mit Coverage
npm run test -- --coverage

# Tests im Watch-Modus (Entwicklung)
npm run test:watch
```

**Test-Framework:** Vitest + Testing Library (React)  
**Test-Location:** `src/**/*.test.ts` und `src/**/*.test.tsx`  
**DOM-Emulation:** jsdom

Jede API-Client-Funktion hat einen Test. Kritische Stores (auth, mode) haben Unit-Tests.

---

## Produktions-Build

```bash
npm run build
# Output: dist/
```

Der Build-Output wird vom Nginx-Container als statische Dateien ausgeliefert (Volume-Sharing mit dem Nginx-Container über `frontend_dist`-Volume).

**Build-Argumente (Docker):**
```dockerfile
ARG VITE_AUTH_BYPASS=false
```

In Produktion muss `VITE_AUTH_BYPASS=false` sein (Standard).

---

## Entwicklungs-Hinweise

### Vite Dev-Proxy

Der Dev-Server (`vite.config.ts`) proxyt automatisch API-Anfragen an `http://localhost:8000`:

```
/auth/*     → http://localhost:8000
/turns      → http://localhost:8000
/claims/*   → http://localhost:8000
/proposals/* → http://localhost:8000
... (alle Backend-Endpunkte)
```

Das bedeutet: Im Dev-Modus muss das Backend auf Port 8000 laufen (lokal oder via Docker).

### Path-Alias

`@/` ist ein Alias für `src/`:
```typescript
import ChatPage from "@/pages/ChatPage";
// = import ChatPage from "../../pages/ChatPage";
```
