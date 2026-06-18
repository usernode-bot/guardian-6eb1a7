# Guardian — notes for Claude Code

This app runs on **Usernode Social Vibecoding**. If you're Claude Code
editing this repo, read the platform conventions before making
changes:

**Platform conventions (authoritative, always current):**
https://social-vibecoding.usernodelabs.org/claude.md

Fetch that URL at the start of each session — it's the single source
of truth for platform-wide behavior (auth model, `USERNODE_ENV`,
public/private tables, "don't `git push`", etc.). The hosted copy is
updated in place when platform rules change, so fetching it gives you
today's rules, not a stale snapshot.

When running inside Usernode's dev-chat, those same conventions are
already injected into your system prompt, so the fetch is a no-op in
that path — but it's the right reflex when someone runs Claude Code
against this repo locally or from another harness.

If a rule below this line conflicts with the hosted conventions, the
hosted conventions win. This file is **app-specific** — write down
things about *this* app that belong in the repo: product intent,
data-model quirks, style preferences, opt-in policies (e.g. which
tables you've marked private), etc.

---

## About Guardian

A mobile companion app for Usernode where users mint and evolve AI-powered Guardian characters based on their FG (Full Graph) network participation. The app tracks FG hours, determines eligibility for minting, manages a collection of 500 unique Guardians with rarity tiers, and displays Guardian evolution stages.

## Architecture Overview (Service-Oriented + Component-Based)

### Backend Services (`src/services/`)

Services handle all business logic, data fetching, and validation:

- **guardianService.ts** — Pool generation, allocation, querying (calls `src/guardians/guardianPool.ts`)
- **fgService.ts** — FG hours, sessions, duration (mocked; later integrates UserNode)
- **eligibilityService.ts** — Eligibility rules: FG >= 1 hour, wallet connected, account valid
- **peerService.ts** — Node status and peer list (mocked)
- **usernodeService.ts** — Auth, wallet validation, user context

### Frontend Components (`public/`)

All components fetch data from services; no embedded business logic:

- **index.html** (PR1 Experience Dashboard) — Fetches real data on DOMContentLoaded, renders Guardian hero, evolution progress, node status, FG metrics
- **guardians.html** (PR5 Guardian Collection Gallery) — Display-only gallery with search/filter; removed allocation button
- **eligibility-check.js** (PR4 new) — Shows eligibility status with failure reasons
- **fg-tracking-card.js** (PR3 new) — Displays FG hours, sessions, total duration
- **Unchanged**: guardian-hero.js, node-status-card.js, evolution-progress-card.js, guardian-lifecycle.js, guardian-card.js, fg-progress-card.js

### Guardian Generation (`src/guardians/`)

Single source of truth for all guardian data generation:

- **guardianPool.ts** — Generates 500 unique guardians with names, lore, tiers, emojis
- **rarity.ts** — Rarity tiers (COMMON 60%, RARE 24%, EPIC 12%, LEGENDARY 3.6%, MYTHIC 0.4%), colors, emoji
- **types.ts** — Guardian, GuardianTier, GuardianMetadata types (frontend + backend)
- **metadata.ts** — Metadata builder (optional)

### API Endpoints

| Endpoint | Method | Response | Service |
|----------|--------|----------|---------|
| `/api/guardians` | GET | `{ guardians[], total, allocated, unallocated }` | guardianService |
| `/api/guardians/allocate` | POST | `{ guardian }` (after eligibility check) | guardianService + eligibilityService |
| `/api/fg` | GET | `{ fgHours, sessions[], duration }` | fgService |
| `/api/eligibility` | GET | `{ eligible, reasons[] }` | eligibilityService |
| `/api/node` | GET | `{ peers, uptime, fgActive }` | peerService |

### PR-to-Responsibility Mapping

| PR | Module | Responsibility | Files |
|----|--------|---|---|
| PR1 | Experience Dashboard | Home screen with Guardian hero, evolution, node status, FG metrics | `public/index.html`, `guardian-hero.js`, `node-status-card.js` |
| PR2 | Network Monitoring | Peer visualization and node status (placeholder) | `public/index.html` screen-network |
| PR3 | FG Tracking Engine | Fetch/display FG hours, sessions, duration | `src/services/fgService.ts`, `public/fg-tracking-card.js` |
| PR4 | Eligibility Engine | Check eligibility; show status with reasons | `src/services/eligibilityService.ts`, `public/eligibility-check.js` |
| PR5 | Guardian Collection Gallery | Display 500 guardians; search, filter, detail view (no allocation) | `public/guardians.html`, `public/guardian-card.js` |
| PR6 | UserNode Integration | Auth, wallet validation, all external API calls | `src/services/usernodeService.ts`, `fgService.ts`, `peerService.ts`, `guardianService.ts` |
| PR7 | Guardian Character Engine | Generate 500 unique guardians with metadata and traits | `src/guardians/guardianPool.ts`, `rarity.ts`, `types.ts`, `data/guardianNames.ts` |

### Staging Mock Data

Services return consistent test data for staging:

- **FG Service**: User `-1` has 12 FG hours (eligible); User `-2` has 0.5 hours (ineligible)
- **Eligibility Service**: All users pass wallet/account validation; fail only if FG < 1 hour
- **Peer Service**: Returns 23 peers, 2h 14m uptime, FG active
- **Guardian Service**: 500 guardians generated in-memory; allocation state reset on server restart

### Deferred Work (DB Persistence)

Schema already created in server.js but not yet queried:

```sql
CREATE TABLE guardian_allocations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES guardian_state(user_id),
  guardian_id VARCHAR(3) NOT NULL,
  allocated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, guardian_id)
);
```

Future: `guardianService.allocateGuardian()` will INSERT/query this table so allocations persist across restarts.

## App-specific conventions

- **No new dependencies** — vanilla JavaScript, TailwindCSS CDN, Express backend
- **No JWT implementation** — relies on platform token injection via `?token=` query param
- **Staging seed data** — `IS_STAGING` blocks in server.js; mock services in `src/services/`
- **Mobile-first** — 480px max-width on home screen; desktop not optimized
- **In-memory allocation** — state lost on server restart; database persistence deferred
