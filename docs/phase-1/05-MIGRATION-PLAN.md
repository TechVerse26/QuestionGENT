# 05 — Migration Plan (with backup and rollback)

EXAM MASTER · Phase 1 (Foundation)

**Goal:** move from the React + Vite single-page app to a Next.js (App Router) platform with a trusted server layer **without losing data, breaking existing features, or taking users offline.** Phase 1 changed nothing in the repository; the first change is stage M1.

**Non-negotiables (from the master prompt):** preserve all working features and data compatibility; never delete or reset production data; no Firebase Storage; Next.js is the main framework and Vite exists only temporarily; every step has a backup and a rollback.

---

## 1. Strategy in one paragraph

A **strangler migration**. First put the *existing* app inside a Next.js shell unchanged (an optional catch-all route renders the legacy router client-side, so every URL, bookmark, invitation link, payment return URL and installed-PWA start URL keeps working). Then add the trusted server layer next to it, evolve the database **additively**, move quota-consuming writes behind the server, and only then tighten Firestore rules. After that, port screens one by one into native App Router routes behind per-page flags, deleting each legacy screen only when its end-to-end test passes. Vite is removed in the last stage.

## 2. Data compatibility contract (must not change without a versioned migration)

| Item | Contract |
| --- | --- |
| Document ids | `memberships/{uid}_{institutionId}`; `answerKeys/b_{questionId}` and `p_{paperId}_{itemId}`; random 16-char ids elsewhere |
| Tenancy | `institutionId` on every institution-owned document |
| Rich text | Tiptap/ProseMirror JSON in string fields `data` and `snapshot`; node/mark set unchanged (extensions may only be *added*) |
| Question search | `searchText` and `fingerprint` algorithms (`utils/question.js`) — duplicate detection depends on them |
| Design | `design.templateId` values `classic, modern, minimal, board, university, coaching, madrasa, training, custom` stay valid forever |
| Roles | the 8 role ids; membership `role` strings |
| Browser keys | `em-institution`, `em-lang`, `em-theme`, `em-gemini-key:<uid>` keep their names so users keep their settings |
| URLs | `/`, `/login`, `/register`, `/forgot-password`, `/verify-email`, `/onboarding`, `/print`, `/app/...` keep working (redirect if a route is renamed) |

## 3. Stages

Each stage lists **entry gate → steps → verification → rollback**. No stage starts before the previous gate is green.

### M0 — Safeguards (before any change)
- **Entry gate:** decisions D1 (Firebase project), D2 (billing), D3 (host) answered.
- **Steps:** confirm which apps use project `tvexam`; create a **staging Firebase project** (and a separate production project if `tvexam` is shared); record the *currently deployed* rules and indexes into git (`rules/releases/pre-migration.rules`, `firestore.indexes.deployed.json`); enable Firestore point-in-time recovery if billing allows; set budget alerts; record baseline document counts per collection and the list of Auth users; `git tag legacy-v0.1.0`; keep the current Vercel deployment as the rollback target.
- **Verification:** baseline report committed; staging project reachable with the emulator-seeded data.
- **Rollback:** none needed (no changes).

### M1 — Repository hygiene (no behaviour change)
- **Steps:** commit lockfiles (root and `functions/`) and switch CI to `npm ci`; ESLint + Prettier; CI with lint, unit tests, `npm audit`, secret scan; rewrite `.env.example`; remove the unused `storageBucket`; add the `firebase/storage` ban; apply the zero-regret fixes from `03-SECURITY-AUDIT.md`; **add the rules test harness and first write *characterization tests* that capture what the current rules allow and deny** — they become the safety net for every later rules change; first deliverable of the backup tooling (`scripts/backup/export-ndjson.js`) and run it against staging **and production before touching anything else**.
- **Verification:** the 44 existing tests plus the characterization suite pass; backup file counts equal the M0 baseline; restore into the emulator succeeds.
- **Rollback:** `git revert` (no data touched).

### M2 — Next.js shell with the legacy bridge
- **Steps:** add Next.js (App Router, JS) at the repo root; move `src/` to `src/legacy/` with `git mv` (via a temporary directory name, so history is preserved); render the legacy `App` from one optional catch-all route (`src/app/[[...slug]]`) with `ssr: false` and no router basename, so URLs are identical; replace the 8 `import.meta.env` uses with a small adapter reading `NEXT_PUBLIC_*` (`BASE_URL` becomes empty, `PROD` becomes `NODE_ENV`); update Tailwind globs; stamp the service-worker build id in a `postbuild` script (replaces the workflow's `sed`); remove the Vite SPA rewrite; keep Vite config only until parity is signed off; no GitHub Pages deploy for the new app (D3).
- **Verification:** `next build` passes; unit tests pass; **automated parity suite** (the 17-row manual checklist in `PROJECT_DOCUMENTATION.md` §7, turned into Playwright tests on the emulator) is green; service-worker upgrade path tested with the *old* worker installed (no stale shell, caches cleaned); installed-PWA start URL and invitation/payment return URLs open correctly.
- **Rollback:** Vercel instant rollback to the last legacy deployment or revert the merge. No data change in this stage.

### M3 — Server foundation (invisible to users)
- **Steps:** Admin SDK initialisation, session-cookie endpoints, request interceptor with security headers and a **Report-Only CSP first** (enforce after a clean soak), rate limiter, audit writer, the `shared` permissions module with generated rule helpers, App Check in monitor mode, `/api/health`. The legacy client still talks to Firestore directly.
- **Verification:** rules tests prove the generated helpers equal the hand-written ones (matrix test); handler integration tests on the emulator; CSP report volume reviewed.
- **Rollback:** flag `SERVER_SESSIONS=off`; the interceptor can be reduced to headers only.

### M4 — Additive data migration (staging first, then production)
- **Steps:** seed `plans` with exactly today's five tiers; seed `templates` with the 9 existing presets (ids preserved; gating per D4); seed `templateCategories`, `systemSettings/public`, `featureFlags`, default `adminRoles`; create a `subscriptions/{institutionId}` document for every institution from `institutions.plan` (and any existing `subscriptions` document); create `usage/{institutionId}` from `count()` aggregations; add `planId` next to `plan` (dual fields). Other documents get `schemaVersion` lazily on their next write — no mass rewrite.
- **Script rules:** idempotent (deterministic ids, merge writes), **dry-run by default**, resumable cursor, bounded batch size, writes a `migrations/{id}` record (counts, checksums), tags every document it creates or changes with `_mig: "<id>"`, **never deletes or overwrites existing fields**.
- **Verification:** before/after counts; sampled diffs; `usage` equals direct counts; the app (legacy and native) behaves identically with and without the new documents.
- **Rollback:** `scripts/migrations/rollback.js <id>` removes only documents/fields recorded for that migration; original fields were never touched, so the legacy app keeps working throughout.

### M5 — Server chokepoint, then rules tightening (three releases)
- **R1 — introduce:** deploy the server APIs for institution creation, member/role changes, invitations and all quota-consuming creates (papers, questions, exports, imports, AI). Legacy services call them behind `USE_SERVER_WRITES`; **rules unchanged**, so direct and server paths both work. A nightly job compares `usage` with real counts.
- **R2 — switch:** raise `systemSettings/public.minClientVersion`, show a "please refresh" prompt, turn the flag on for everyone, soak 1–2 weeks while watching error rates and App Check metrics.
- **R3 — tighten:** deploy new rules to staging → full rules suite + e2e → production: deny direct creates on quota-consuming collections, add field validators (types, sizes, enums, array caps), `users` field allow-list, deny client writes to logs, make membership writes server-only after bootstrap. Keep the previous ruleset as `rules/releases/vN-1.rules`.
- **Verification:** the tenant-isolation matrix (role × collection × operation × own/other tenant) passes; a scripted "bypass attempt" suite (write directly past a limit, forge a log, create 50 institutions, apply a paid template id) is **denied**; e2e green.
- **Rollback:** redeploy the previous ruleset (seconds); flag off returns to direct writes while R3 is not applied; after R3, rollback = previous ruleset **then** flag off.

### M6 — Native ports, screen by screen
- **Order:** public and auth pages (server-rendered) → shell (sidebar/header on shadcn) → notifications, settings, team, academics, subscription → question bank → paper library → **builder + editors + preview** (largest) → templates and Design Studio → import/export → AI → dashboard/analytics. New phase features are built natively from the start.
- **Per page:** move to `src/features/<name>` + an App Router route; i18n keys migrated by codemod; e2e for that page must pass; the legacy route is removed from the legacy router only afterwards; flag `native:<page>` allows an instant fall-back.
- **Rollback:** flip the page flag.

### M7 — Decommission legacy
- **Steps:** when the legacy router is empty remove `src/legacy`, Vite config, `index.html`, GitHub Pages workflow, `react-router-dom`; tag `legacy-final`. Drop the dual `plan`/`planId` fields only after **two stable releases**, preceded by a fresh backup.
- **Rollback:** restore from tag and backup.

### M8 — Post-migration
30-day monitoring (errors, cost, slow queries, usage drift), remove flags, archive the migration records, run the first restore drill.

## 4. Backup and restore

| Layer | What | When | Where |
| --- | --- | --- | --- |
| Logical export | every collection and subcollection as gzip-NDJSON + manifest (counts, SHA-256), encrypted | nightly and before every migration/rules release | private R2/S3 bucket (never Firebase Storage) |
| Point-in-time recovery | Firestore PITR (7-day window) | continuous, if billing allows | Google-managed |
| Auth users | Auth export (contains password hashes → treat as a secret) | before M5 and monthly | encrypted, same bucket |
| Rules and indexes | every deployed version | every deploy | git (`rules/releases/`) |
| Config | list of secret *names* and non-secret settings | each release | `docs/deployment.md` |

**Restore paths:** (a) full restore into the **emulator or a new project** for drills and disasters (`scripts/restore/import-ndjson.js --target … --dry-run`); (b) selective restore of one collection or id set with `--merge` (never overwrite newer documents by default); (c) PITR clone or export at a chosen timestamp — confirm the current Google procedure at the time. **Proposed targets (to confirm):** RPO <= 24 h for logical backups (minutes with PITR), RTO <= 4 h. A monthly restore drill is part of M8 and Phase 9.

## 5. Rollback matrix

| Stage | Failure signal | Action | Data impact |
| --- | --- | --- | --- |
| M1 | CI or tests red | revert commit | none |
| M2 | build or parity failure, SW issues | instant host rollback to legacy deployment | none |
| M3 | session or header problems | flags off; headers-only mode | none |
| M4 | counts mismatch | rollback script by migration id | only migration-created docs/fields removed |
| M5-R1/R2 | usage drift, API errors | flag off (direct writes still allowed) | none |
| M5-R3 | legitimate writes denied | redeploy previous ruleset, then flag off | none |
| M6 | page regression | `native:<page>` flag | none |
| M7 | missing capability | restore tag + backup | restore-bounded |

## 6. Rules and index deployment protocol

Rules and indexes are changed **only by pull request**: rules tests → staging deploy → e2e → production deploy by CI with a manual approval; never edited in the console. Indexes are added *before* the code that needs them and removed only after two releases; large index builds are scheduled (they can take minutes to hours) and verified before the dependent release. Every release stores its rules file under `rules/releases/`.

## 7. Client rollout and version gating

Each build exposes `appVersion` (git sha). `systemSettings/public.minClientVersion` lets the server demand a refresh; the service worker updates in the background and a "new version available" prompt appears. Offline-queued writes created by an old client are drained before the write path switches (R2 waits for the soak period).

## 8. Migration risk register

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | Shared Firebase project overwritten by these rules (S-01) | D1 before any deploy; staging project; never deploy from a laptop |
| R2 | Old service worker serves a stale shell | tested upgrade path in M2; kill-switch worker available |
| R3 | URLs change (invitations, payment return, PWA start) | identical URLs in M2; redirects if renamed |
| R4 | Users lose language/theme/institution/AI-key settings | keep storage key names |
| R5 | Offline queue conflicts when writes move to the server | gate on min client version; soak period |
| R6 | Big-bang rewrite temptation | page flags; legacy stays until each e2e passes |
| R7 | Library incompatibility (Tiptap, dnd-kit, Recharts with the new React/Next) | compatibility spike at the start of M2 (D8) |
| R8 | Bengali PDF fidelity from the server renderer | spike with real papers before committing (Phase 8) |
| R9 | Unexpected Firebase/hosting cost | budgets, alerts, quotas; cost notes per feature |
| R10 | Index builds delay releases | add indexes one release early |
| R11 | Sandbox without network cannot run installs/emulators | D0 — enable network or run commands locally and send results |

## 9. Parity checklist (becomes the Playwright suite in M2)

Registration + e-mail verification gate · institution creation and isolation (two users, two institutions) · roles and invitations · one question of every type saved and reopened · mixed paper with correct marks · answering rule ("answer any N") · question bank search/filter/favorite/archive/duplicate/history restore · import with a bad row · AI generation (mocked provider) · template apply and custom save · Bengali PDF page count equals preview · Word export opens · sets A–D equal marks and matching keys · review → approve → publish with two accounts · free-plan limits refuse creation · viewer cannot open a draft or a key · mobile edit/preview toggle.
