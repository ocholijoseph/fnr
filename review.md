# Freedom Naija Radio — Codebase Review

## Project Overview

A React + Vite + TypeScript radio station web app (with Android via Capacitor). Features include live audio streaming, a news aggregator (NewsAPI / NewsData / GNews), a scrolling ticker, donation integration (Paystack), testimonies/prayer requests, and an admin dashboard. Data is stored in both Supabase and local JSON files.

---

## Critical Security Issues

### 1. Hardcoded Admin Password

`kfmx-admin-2024` is hardcoded as the default fallback in:

- `vite.config.ts:602`
- `api-server.js:17`
- All `functions/api/*.ts`
- `.env.example:3`

This password grants full admin access. It is in version control and used as a runtime default.

### 2. Paystack Test Key in Client Code

`src/components/DonationModal.tsx:72` — `pk_test_86bdd5466ad3348adf0db92923e85232cb366f10` is hardcoded. All payments run in test mode. Must be moved to an env var and switched to a live key.

### 3. Auth Diagnostic Leak in Cloudflare Functions

`functions/api/prayer-request.ts:29-34` and `functions/api/scroll.ts:54-59` — 401 responses include `providedLength`, `expectedLength`, and `hasEnv`. An attacker can enumerate the password length and confirm env var presence.

### 4. XSS via `dangerouslySetInnerHTML`

- `src/components/NewsAccordion.tsx:229` — renders raw admin-authored HTML
- `src/components/ArchivedNewsModal.tsx:124` — regex HTML strip then passes to `dangerouslySetInnerHTML` (regex can be bypassed)

### 5. No Rate Limiting on Public POST Endpoints

`/api/donations`, `/api/prayer-request`, `/api/testimonies`, `/api/news-headlines/fetch` are all publicly POSTable with no throttling. Anyone can spam submissions or exhaust news API quotas.

### 6. Admin Password in Plaintext `sessionStorage`

`src/pages/Admin.tsx:194` — stored unencrypted. Any XSS vulnerability across the entire app exposes it.

---

## Critical Bugs

### 1. Playback History Not Persisted

`src/pages/Index.tsx:208` — history is pushed to state but never written back to `localStorage`. It is only loaded on mount (lines 34-43). History is lost on reload.

### 2. Metadata Polling Timer Leak

`src/pages/Index.tsx:287-310` — recursive `setTimeout` pattern only clears the initial timeout in cleanup. If the component unmounts mid-poll, subsequent timeouts fire on an unmounted component.

### 3. `robot.txt` Wrong Filename

`public/robot.txt` should be `robots.txt` (plural). Crawlers will ignore it entirely — SEO is broken.

### 4. Cloudflare KV Placeholder

`wrangler.toml:22` — `id = "PLACE_YOUR_KV_NAMESPACE_ID_HERE"`. Cloudflare deployment will fail.

### 5. Embed Page is Non-Functional

`src/pages/Embed.tsx` — hardcoded HTTP stream URL (`http://69.197.134.188:8000/live`), mock metadata, no real data fetching. Also exposes internal server IP.

### 6. Fixed Viewport

`src/App.css:7-21` — `#root` is locked to `412x915px` with `position: fixed`. The app is non-responsive: on desktop it appears as a small phone-sized box; on small screens content is clipped.

### 7. Stale Branding

`wrangler.toml` — project name is `kingdomfm-player`, domain pattern is `player.kingdomfm.live`. Leftover from a previous project name.

---

## Significant Code Quality Issues

### 1. Monolithic Files

| File | Lines | Problem |
|------|-------|---------|
| `vite.config.ts` | 1102 | Contains entire news aggregator, all API middleware, Supabase logic, and rate limiting. Should be a separate backend. |
| `api-server.js` | 951 | Duplicates nearly all of `vite.config.ts`'s API logic. Both must be maintained in sync. |
| `src/pages/Admin.tsx` | 771 | Needs decomposition into sub-components. |
| `src/components/RadioPlayer.tsx` | 597 | Needs decomposition. |

### 2. Massive Code Duplication

The entire API layer (news aggregator, scroll, socials, testimonies, prayer requests, donations, news CRUD) is implemented **twice**:

- Inside `vite.config.ts` as a Vite plugin (dev server)
- In `api-server.js` as a standalone Node server (production)

Both have identical logic but slightly different implementations, making bugs likely to appear in one but not the other.

### 3. ESLint: 2439 Errors

Mostly `no-undef` for `process`/`console` in Node.js scripts. The ESLint config targets `**/*.{ts,tsx}` but `.js` scripts run in Node, not the browser. They need a separate config or `ignorePatterns`.

### 4. Pervasive `any` Types

Admin components use `any[]` for news, headlines, and config data. This defeats TypeScript's safety guarantees.

### 5. Duplicate `@layer base` in `src/Index.css`

Lines 51-66 and 205-212 both define base layer styles. The second overrides the first.

### 6. Dead Code

`src/lib/api.ts` — a Strapi CMS client that is no longer the primary data source. Only imported for types by `news-storage.ts`.

### 7. No Tests

Zero test files exist. No test framework is configured.

---

## Performance Issues

### 1. Every-Second Re-renders

`RadioPlayer.tsx:51` — `setInterval` for clock display causes a re-render every second, even when the player is idle.

### 2. Audio Event Listener Re-registration

`RadioPlayer.tsx:270` — the massive `useEffect` has `hasSignal` in its dependency array. When `handleStalled` changes `hasSignal`, all 8+ event listeners are torn down and re-registered, creating a feedback loop.

### 3. No Database Indexes

`scripts/create-supabase-tables.sql` — no indexes beyond primary keys. Queries filtering by `provider`, `region`, or `timestamp` on `news_headlines` will degrade with scale.

### 4. No Supabase RLS Policies

Tables have no Row Level Security. The anon key has unrestricted access.

---

## Additional Findings

### Listener Count Inflation

`src/pages/Index.tsx:176-178` — listener count is artificially inflated by a hardcoded `+ 27` offset. This is deceptive.

### Schedule Data Hardcoded

`src/components/ScheduleView.tsx` — all schedule data is hardcoded. No API integration. The "ON AIR" indicator does not update in real-time.

### No Pagination on Testimonies

`src/components/ReadTestimoniesModal.tsx` — all testimonies are loaded at once with no virtualization or pagination.

### Invalid Date Handling

`src/components/ReadTestimoniesModal.tsx:86` — `format(new Date(testimony.createdAt), ...)` will throw if `createdAt` is an invalid date string.

### `json-storage.ts` Clears All localStorage

`src/lib/json-storage.ts:31` — `clear()` calls `localStorage.clear()` which removes ALL localStorage data, not just this app's keys.

### Cloudflare Functions: No Input Validation

`functions/api/donations.ts:56` — POST body is accepted as-is. No schema validation. `functions/api/socials.ts` — accepts any JSON array.

### Supabase `deleteAll` Workaround

`src/lib/supabase.ts:105` — uses `.neq('id', '')` to delete all rows. Rows with empty string IDs would survive.

### `news-storage.ts` Performance

`src/lib/news-storage.ts:65-73` — `isArchived()` and `getArchivedCount()` both parse JSON from localStorage on every call. Should cache or memoize.

### `NotFound.tsx` Full Page Reload

Uses `<a href="/">` instead of React Router's `<Link to="/">`, causing a full page reload.

---

## Proposals (Priority Order)

| Priority | Issue | Fix |
|----------|-------|-----|
| P0 | Hardcoded admin password | Remove all defaults; require env var; fail to start if missing |
| P0 | Paystack test key | Move to env var; use `VITE_PAYSTACK_PUBLIC_KEY` |
| P0 | Auth diagnostic leak | Remove `providedLength`/`expectedLength`/`hasEnv` from 401 responses |
| P0 | XSS in news rendering | Sanitize HTML with DOMPurify before rendering |
| P1 | Duplicate API layer | Extract shared API logic into a module; import in both `vite.config.ts` and `api-server.js` |
| P1 | Timer leak in Index.tsx | Use `useRef` for recursive timeout ID; clear in cleanup |
| P1 | History not persisted | Write to `localStorage` after each history update |
| P1 | `robot.txt` rename | Rename `public/robot.txt` to `public/robots.txt` |
| P1 | Rate limiting | Add rate limiting middleware to public POST endpoints |
| P2 | Fixed viewport in App.css | Replace with responsive Tailwind breakpoints |
| P2 | Monolithic components | Split `Admin.tsx` and `RadioPlayer.tsx` into sub-components |
| P2 | ESLint config for scripts | Add `ignorePatterns: ["scripts/**", "api-server.js"]` |
| P2 | Missing DB indexes & RLS | Add indexes; enable RLS policies in Supabase |
| P3 | Remove dead code | Delete `src/lib/api.ts` Strapi client |
| P3 | Add test framework | Set up Vitest + React Testing Library |
| P3 | Embed page | Either implement properly or remove |
| P3 | Branding cleanup | Update `wrangler.toml` project name and domain |
