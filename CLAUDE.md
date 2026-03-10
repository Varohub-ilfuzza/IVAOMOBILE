# CLAUDE.md — IVAO Companion

> AI assistant guide for the IVAO Companion codebase.
> **Author:** Álvaro · AirNubeiro (NBV) · IVAO VID 687072
> **Current version:** v3.0 (2026-02-28)

---

## Project Overview

IVAO Companion is a **mobile-first React web app** for tracking live IVAO flight traffic, managing a friends list, and viewing your own flight data in real time. It is designed as a **single portable JSX file** that runs without any build step, targeting the Claude.ai embedded environment and static hosting (GitHub Pages).

---

## Repository Structure

```
IVAOMOBILE/
├── ivao-companion-v3.jsx        # Main application (single file, ~1,130 lines)
├── CHANGELOG-ivao-companion.md  # Detailed version history and technical notes
├── README.md                    # Project title only
└── CLAUDE.md                    # This file
```

There is **no package.json, no build configuration, no test suite, and no CI/CD pipeline.** This is intentional — the app is designed to run as a raw JSX file.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | React (hooks only — useState, useEffect, useRef, useCallback) |
| Language | JavaScript (JSX, no TypeScript) |
| Styling | Embedded CSS-in-JS (a single template literal string `S`) |
| Map | Leaflet 1.9.4 (loaded via CDN at runtime) |
| Fonts | Google Fonts — Plus Jakarta Sans + JetBrains Mono |
| Auth | OAuth2 Authorization Code + PKCE (no client secret) |
| External APIs | IVAO SSO, IVAO API v2, OpenStreetMap |
| CORS fallback | Claude API proxy (`api.anthropic.com/v1/messages`) |

---

## File Layout (ivao-companion-v3.jsx)

The single file is organized top-to-bottom in this order:

| Section | Lines (approx.) | Description |
|---|---|---|
| Imports | 1 | React hooks only |
| `CFG` config object | 8–17 | All endpoints, OAuth settings, refresh interval |
| PKCE helpers | 19–50 | `generatePKCE()`, `buildAuthUrl()`, `decodeJWT()` |
| Misc helpers | 52–68 | `fmtCoord`, `fmtTime`, `phaseOf`, `pilotRatingLabel` |
| CSS string `S` | 71–262 | Full mobile stylesheet as a template literal |
| UI primitives | ~264–373 | `Spin`, `Compass`, `DataCell`, `NetworkBar`, `DetailPanel` |
| `LoginScreen` | ~376–630 | OAuth2 PKCE popup+polling flow + VID fallback |
| `FlightTab` | ~633–789 | My flight dashboard with instruments, FPL, nearby ATC |
| `MapTab` | ~792–890 | Leaflet map with pilot/ATC markers and filters |
| `FriendsTab` | ~893–985 | Friends list by VID with real-time online status |
| `App` (main) | ~988–1128 | State management, data fetching, tab navigation |
| `export default App` | last line | Default export |

---

## Key Configuration (`CFG` object)

```js
const CFG = {
  clientId:    "1e1a3f0b-8703-45a4-9ac4-c3d32c",  // ⚠️ verify full UUID on developers.ivao.aero
  redirectUri: "https://claude.ai",               // registered redirect
  sso:         "https://sso.ivao.aero",
  api:         "https://api.ivao.aero/v2",
  whazzup:     "https://api.ivao.aero/v2/tracker/whazzup",
  claudeApi:   "https://api.anthropic.com/v1/messages",
  scopes:      "openid email",
  refreshMs:   30000,  // live data refresh interval
};
```

**⚠️ Important:** The `clientId` may be truncated (the captured UUID shows `c3d32c` at the end, but a full UUID is 32 hex chars + 4 dashes). Verify at developers.ivao.aero before any OAuth-related work.

---

## Authentication Flow

The app implements **OAuth2 Authorization Code + PKCE**:

1. Generate `code_verifier` (crypto.getRandomValues) and `code_challenge` (SHA-256 → base64url)
2. Open IVAO SSO popup with `response_type=code`, `code_challenge`, anti-CSRF `state`
3. Poll popup location every 500ms — cross-origin throws (expected), silence it
4. When popup redirects to `claude.ai` (same origin), catch the `code` + verify `state`
5. Close popup automatically, POST to `sso.ivao.aero/token` with `code` + `code_verifier`
6. Decode JWT `access_token` payload to extract `sub` (VID) — **no signature verification**
7. Fetch `GET /v2/users/me` with Bearer token for full profile

**CORS fallback:** If direct fetch fails, retry via Claude API proxy. This is a known architectural constraint, not a bug.

**Fallback login:** VID-only (no OAuth) if popup is blocked or unavailable.

**Token storage:** React state only — never `localStorage`. Cleared on page reload.

---

## Data Flow

```
App (root state)
  ├── auth state: { token, vid, profile }
  ├── pilotData: live flight data for current user
  ├── allTraffic: full IVAO whazzup snapshot
  ├── networkStats: network statistics object
  ├── friends: array of VID strings
  └── refreshing: boolean
```

All data is fetched in `App`, passed down as props. No Context API, no Redux.

Live data is refreshed every `CFG.refreshMs` (30 000 ms) via `useEffect` + `setInterval`.

---

## Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Constants | UPPERCASE | `CFG`, `S` |
| Functions | camelCase | `generatePKCE`, `fmtCoord`, `phaseOf` |
| React components | PascalCase | `LoginScreen`, `FlightTab`, `App` |
| State variables | camelCase | `pilotData`, `allTraffic`, `refreshing` |
| CSS classes | kebab-case | `.tab-bar`, `.btn-primary`, `.card-hero` |
| CSS vars | `--name` | `--blue`, `--text2`, `--brd` |

---

## Styling Conventions

All CSS lives in the `S` template literal constant. CSS custom properties (variables) define the design tokens:

```css
--bg, --bg1, --bg2, --bg3      /* background layers */
--blue, --blue2, --blue3, --blue4  /* brand blues */
--amber, --green, --red         /* status colors */
--text, --text2, --text3        /* text hierarchy */
--brd, --brd2                   /* borders */
--sh, --sh-md                   /* shadows */
```

**Do not add inline styles for layout or theming** — use the existing CSS classes and CSS variables instead. Inline styles are only acceptable for dynamic values (e.g., rotation angles, computed widths, live data-derived colors).

The app is **mobile-first with max-width 480px** centered on desktop.

---

## IVAO API Reference

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /v2/tracker/whazzup` | None | Full live traffic snapshot |
| `POST sso.ivao.aero/token` | PKCE | Exchange code for access token |
| `GET /v2/users/me` | Bearer | Authenticated user profile |
| `GET /v2/users/me` (flight plans) | Bearer + scopes | Planned for v1.1 |

All fetch calls should include CORS error handling and fall back to the Claude API proxy when needed.

---

## Pilot Rating Labels

```js
["","FS1","FS2","FS3","PP","SPP","CP","ATP","SFI","CFI"][n]
```
Index 0 is unused (no rating). Unknown values fall back to `R{n}`.

---

## Flight Phase Logic

```js
if (p.onGround)         → { label: "EN TIERRA", color: amber, dot: "🟡" }
if (p.altitude < 1500)  → { label: "T/O — LND",  color: orange, dot: "🟠" }
else                    → { label: "AIRBORNE",    color: green,  dot: "🟢" }
```

---

## Language

- **UI text:** Spanish (`EN TIERRA`, `AMIGOS`, `TRÁFICO`, etc.)
- **Code comments:** Spanish + English mix (both are acceptable)
- **Number formatting:** ES-ES locale (`toLocaleString('es-ES')`)
- **Time:** UTC for all aviation values; local time via `toLocaleTimeString`

---

## Git Workflow

```
master                              # stable releases
claude/<session-id>                 # Claude Code working branches (auto-created)
```

Commit messages are short and descriptive. Spanish is acceptable. Examples from history:
- `V3 con login`
- `Delete ivao-companion-v2.jsx`

**Always develop on the designated `claude/<session-id>` branch and push there.** Never push to `master` without explicit instruction.

---

## Development Rules for AI Assistants

1. **Single-file architecture is intentional.** Do not create additional files, extract components to separate modules, or add a build system unless explicitly asked.
2. **No package.json, no npm.** Dependencies are loaded via CDN or are already browser-native.
3. **All CSS goes in the `S` constant.** Do not add `<style>` tags or separate CSS files.
4. **No localStorage.** All state is in React memory. Do not add persistence without explicit instruction.
5. **No TypeScript.** Keep the file as plain JSX.
6. **Preserve the file section order** (config → helpers → styles → primitives → screens → App → export).
7. **CORS failures are expected** on some endpoints. The Claude API proxy fallback pattern is intentional — do not remove it.
8. **Do not verify JWT signatures.** The app intentionally only decodes the payload for user data display.
9. **Client ID may be truncated** — never assume the value in `CFG.clientId` is correct without checking developers.ivao.aero.
10. **Test manually** — there is no automated test suite. Describe the steps to manually verify any change.

---

## Roadmap (from CHANGELOG)

| Version | Features |
|---|---|
| v1.1 | Extended profile, flight plan create/read from app |
| v1.2 | Remote control (RustDesk/Parsec) guide for LAN Altitude UI access |
| v1.3 | Nubeiro AWOS weather integration, friend persistence (IndexedDB), push alerts |
| v2.0 | PWA / Capacitor native mobile app with service worker |

---

## IVAO App Registration

```
App Name:    MobileAPP
Status:      Active
User ID:     687072
Client ID:   1e1a3f0b-8703-45a4-9ac4-c3d32c  ← VERIFY full UUID
Redirect:    https://claude.ai  ✅
             https://[github-pages-url]  ✅
```

Registered at: `developers.ivao.aero`
