# Phase 2 — Progress report (Part A: the offline-verifiable foundation)

2026-11-18 · built in a sandbox **without network access**, so everything below was verified with the tools that exist offline (Node test runner, `esbuild`, the preinstalled `zod`, `docx`, `jszip`). Nothing that needs `npm install`, Firebase, Next.js or a browser was run.

## Status by work package

| WP | Status | Done now | Still to do (needs network) |
| --- | --- | --- | --- |
| 2.1 Hygiene and CI | **Partial** | Zero-regret fixes S-05, S-07, S-22; `.gitignore` hardened; `npm test` runs every test; repository **policy tests** (no Firebase Storage, no secrets, layering, `.env.example` clean) | Lockfiles, ESLint/Prettier, GitHub Actions CI, rewritten `.env.example`, **rules test harness on the emulator** |
| 2.2 Next.js shell + legacy bridge | Not started | `esbuild` proves the whole legacy import graph resolves and all 68 JSX files parse | Install Next, move `src` → `src/legacy`, catch-all route, env adapter, Playwright parity suite |
| 2.3 Server foundation | **Partial** | Tested building blocks: CSP and security headers, CSRF guard, rate limiter, audit-entry builder, TOTP MFA, AES-256-GCM vault | Admin SDK init, session-cookie endpoints, middleware wiring, health endpoint |
| 2.4 `shared` module | **Done** (Part A) | Tenant + platform permission matrices, plan seed and entitlement engine, 50-template access matrix, Zod input schemas | Make legacy constants re-export from `shared` (later, during the port) |
| 2.5 Authentication | Not started | Input schemas ready | Server-side verified-e-mail and account-status checks, sessions list/revoke |
| 2.6 Data migration + chokepoint + rules tightening | Not started | Entitlement engine and usage math ready | Seed scripts, server APIs, rules R1–R3 (needs the emulator) |
| 2.7 Storage abstraction | **Partial** | Upload request schema (allow-listed types, size caps per purpose, name sanitising) | Provider interface, Cloudinary signed upload, Backblaze B2 adapter |
| 2.8 UI foundation | Not started | — | shadcn base, token mapping, i18n infrastructure |
| 2.9 Read-efficiency (new) | **Partial** | Free-quota exhaustion now shows a clear English/Bengali message | Smaller default page sizes, "load more", dashboard stats document |
| Backup tooling v1 | **Done** (logic) | Encrypted gzip-NDJSON export, verify, restore with guards; tamper/truncation matrix; restore **drill** passes; backup list is tested against `firestore.rules` | Admin SDK source/sink adapters, GitHub Actions job, off-site destination |

## What was verified

- **121 tests, all passing** (44 original + 77 new): `node --test "tests/**/*.test.mjs"`.
- The previously unrunnable `export` test now runs (2/2).
- `esbuild` bundles `src/main.jsx` and parses all 68 JSX files (the repository's own `npm run check` approach).
- TOTP matches the **RFC 4226 and RFC 6238 test vectors** (SHA-1/256/512).
- **Drift guards:** the role helper functions in `firestore.rules` equal what the permission matrix generates; plan prices and AI credits in the two Cloud Function files equal the seed; the backup list equals the collections in `firestore.rules`; the template matrix yields **20 / 28 / 38 / 45 / 50**.
- **Encryption:** every byte region tampered, truncation at a chunk boundary, appended or reordered chunks and a wrong key are all rejected; a multi-megabyte encrypted export restores identically (including NaN, -0, Timestamps, GeoPoints, references, bytes, a user field literally named `__t`).
- Bugs the tests found and fixed during this work: the vault accepted tokens with extra segments; the rules-parity test mis-detected indentation.

## What was NOT verified

Next.js build, Firebase SDK/Admin SDK integration, Firestore rules in the emulator, SSLCommerz/Cloudinary/Gemini/Backblaze, real-browser behaviour (CSP, the print flow, the Toast), performance and the quota estimates in the addendum.

## Behaviour changes in the legacy app

| Change | Effect |
| --- | --- |
| Print payload is deleted when read, expires after 10 minutes (S-07) | Reloading the print tab shows the "expired" state; print again from the builder |
| pdf.js runs with `isEvalSupported:false` (S-05) | No visible change; mitigates CVE-2024-4367 until pdf.js is bundled and upgraded |
| `storageBucket` removed from config and `.env*` (S-22) | No visible change |
| Firestore "Quota exceeded" → clear message in English/Bengali | New text in `bn.js`; shown in the Toast |

## Finding status after Part A

| Finding | State |
| --- | --- |
| S-05 pdf.js | Mitigated (option set); bundling/upgrade still to do |
| S-07 answer keys in `localStorage` | **Fixed** (one-shot, 10 min) |
| S-22 storage bucket setting | **Fixed** + policy test forbids any Firebase Storage use |
| S-15 permission matrix in three places | **Guarded** by a drift test; single-source migration continues |
| S-08 audit logs, S-12 rate limits, S-13 headers | Building blocks ready and tested; **not wired** yet |
| S-02, S-03, S-04, S-06, S-09–S-11, S-14, S-16–S-21, S-23 | Unchanged (need the server layer, emulator, or later phases) |

## New files

```
src/shared/permissions/   tenant.js  platform.js  rulesHelpers.js  index.js
src/shared/plans/         tiers.js  seed.js  entitlements.js  index.js
src/shared/templates/     catalog.js
src/shared/schemas/       primitives.js  server.js  index.js
src/server/security/      totp.js  vault.js  headers.js  csrf.js
src/server/ratelimit/     limiter.js
src/server/audit/         entry.js
src/server/backup/        targets.js  codec.js  crypto.js  stores.js  ndjson.js
src/utils/firebaseErrors.js
tests/shared/  tests/server/  tests/policy.test.mjs  tests/legacy-fixes.test.mjs
docs/phase-1/  docs/phase-2/  docs/HANDOFF.md
```

## Run it

```bash
npm test                      # 121 tests (needs zod, docx, jszip installed: `npm install`)
npm run check                 # esbuild bundle of the app (syntax + import graph)
```
