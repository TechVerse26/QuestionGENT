# 01 — Repository Audit

EXAM MASTER · Phase 1 (Foundation) · audited 2026-11-16

**Method.** Every one of the 224 files in `EXAM-QUESTION-GENERATOR-main.zip` was inventoried; all Firebase, Cloud Functions, security, payment, AI, export, import, routing, store and service code was read in full; the rest was sampled and measured with scripts. What could run offline was run (see section 8). Nothing here was executed against a real Firebase project: the audit sandbox has no network, so `npm install`, `vite build` and the emulators could not run. Statements below are therefore *static findings with file evidence*, not runtime results.

---

## 1. Snapshot

| Item | Finding |
| --- | --- |
| Package | `exam-master` 0.1.0, ES modules, Node >= 18 |
| Size | 224 files (68 JSX, 67 JS, 5 JSON, 2 CSS …), about 10k lines of JS/JSX/CSS plus about 640 lines of tests |
| Front end | React 18.3, Vite 5, Tailwind 3.4, React Router 6.27 (used in 23 files), Zustand 4.5, React Hook Form 7 + Zod 3 (4 files only), Tiptap 2.9, KaTeX 0.16, dnd-kit, Recharts 2.13, lucide-react (<0.500) |
| Export / import libs | `docx` 9.5, `jszip`, `mammoth`, `papaparse`, `xlsx` 0.18.5, pdf.js 3.11.174 (loaded from a CDN at runtime) |
| Firebase | Auth + Firestore through the web SDK 10.14 straight from the browser; Cloud Functions v2 (Node 20, CommonJS, `firebase-admin` 12.6, `firebase-functions` 6.1) |
| Hosting / CI | Vercel (README primary, `vercel.json` SPA rewrite) and a GitHub Pages workflow (`.github/workflows/deploy.yml`) |
| Firebase project id in repo | `tvexam` (`.firebaserc`, `.env.production`) |
| i18n | Own dictionary: English text is the key, `src/i18n/bn.js` (798 lines) supplies Bengali; about 959 `t()` calls |
| Tests | 3 files, 44 cases (core 12, AI 30, export 2) — logic only |
| Lockfiles | **none** (root or `functions/`) |
| Lint / format config | **none** |
| Firebase Storage usage | **none** (no `firebase/storage` import, no `getStorage`/`uploadBytes`); only the unused `storageBucket` config key |

## 2. Directory map

```
src/
  App.jsx, main.jsx            bootstrap: ErrorBoundary > I18n > Toast > Confirm > Router
  routes/                      AppRoutes.jsx (16 lazy routes), guards.jsx (RequireAuth, RequireInstitution, Can)
  layouts/                     MainLayout, AuthLayout, DashboardLayout (sidebar, header, institution switcher)
  pages/ (33 files)            Landing, Authentication, Institution/Onboarding, Dashboard, PaperLibrary,
                               QuestionBuilder (paper builder + 8 panels/dialogs), QuestionBank, Templates,
                               DesignStudio, AnswerKeys, ImportExport, AI, Teachers(team), Subjects(academics),
                               Analytics, Subscription, Notifications, Settings, Print
  editors/ (12 files)          one editor per question family (MCQ, CQ, short, broad, math, fill, TF, matching, practical, custom, extras)
  question-types/              registry.js (20 types) + blocks.js (type -> printable blocks)
  preview/                     paperModel.js, paginate.js, PaperDocument.jsx (paged renderer shared by preview and print)
  export/                      docxExport.js (351 lines), printExport.js, jsonExport.js, runExport.js
  import/parsers.js            CSV / XLSX / XLS / TXT / DOCX / PDF readers
  services/ (14)               every Firebase call lives here (auth, institution, question, paper, template, academic,
                               notification, activity, plan, upload, aiService, aiKey, gemini, db)
  store/ hooks/                Zustand: auth, ui, builder, bank, academic; useCurrent
  utils/ constants/ validators/ pure logic (marks, numbering, sets, shuffle, bulkParse, importMap, richtext ...) and role/plan/template data
  i18n/ pwa/                   dictionary + provider; install prompt + service-worker registration
functions/                     src/index.js, ai/generateQuestions.js, payments/sslcommerz.js, security/authz.js, scripts/set-super-admin.js
public/                        sw.js (hand-written service worker), manifest, icons
tests/                         core.test.mjs, ai.test.mjs, export.test.mjs
firestore.rules, firestore.indexes.json, firebase.json, vercel.json, .github/workflows/deploy.yml
README.md, PROJECT_DOCUMENTATION.md
```

## 3. How the system works today

1. **Boot.** `authStore.init()` listens to Firebase Auth, loads the user doc (creates it on first login), the user's `memberships` and the matching `institutions`, and reads the `superAdmin` custom claim into `isSuper` (the flag is never used by any route or screen).
2. **Tenancy.** A user can belong to many institutions through `memberships/{uid}_{institutionId}`; the active one is kept in `localStorage` (`em-institution`). Every institution-owned document carries `institutionId`; list queries always filter on it (`services/db.js: listBy`).
3. **Authorization.** `constants/roles.js` (8 roles, 20 permissions) drives menus and `<Can>` guards. The same matrix is re-implemented as functions in `firestore.rules` and, for 3 roles, in `functions/src/security/authz.js`. Three copies of one truth.
4. **Data access.** The browser reads and writes Firestore directly; there is no server API. Writes are batched in small groups because of the rules' `get()` limits.
5. **Paper model.** A paper stores `info`, `design`, `sections` (ordered item ids) and `totals`; each question is its own document in `questionPapers/{id}/items`; versions are JSON snapshots in `versions`. Rich text is Tiptap JSON kept in **string** fields (`data`, `snapshot`) and excluded from indexing.
6. **Rendering.** `paperModel` turns paper + items into a renderer-independent structure; `PaperDocument` paginates it into exact-size pages; the same component feeds the live preview and the `/print` route; `docxExport` consumes the same model.
7. **PDF.** The builder stores the whole payload (paper, items **and answer keys**) in `localStorage` under `em-print-*`, opens `/print?k=…` in a new tab, and the user saves a PDF with the browser print dialog.
8. **AI.** Default `VITE_AI_MODE=direct`: the browser calls Gemini with the user's own key kept in `localStorage`; plan credits are not applied. `functions` mode calls the `generateQuestions` callable (key in Secret Manager, role check, 6 requests/minute, per-institution credits).
9. **Payments.** `createPaymentSession` (callable) opens an SSLCommerz session; `sslcommerzCallback` (HTTPS) validates the transaction with SSLCommerz, then marks the payment paid and sets the institution plan for 30 days. The code states it was never run end to end.
10. **PWA.** Hand-written `public/sw.js` (network-first shell, hashed assets cached, build id stamped by the GitHub workflow with `sed`).

## 4. Firestore data model as implemented

| Collection | Written by | Notes |
| --- | --- | --- |
| `users/{uid}` | owner | profile, `prefs`; `status` is written but never read |
| `institutions/{id}` | client (create, admin update); functions (`plan`, `aiUsed`) | `plan` and `aiUsed` are rule-protected against clients |
| `memberships/{uid}_{institutionId}` | client | role + denormalized name/email/photo |
| `invitations/{id}` | admin creates; invitee changes status | verified email required; not e-mailed |
| `branches, departments, classes, groups, subjects, sessions, chapters, topics, examinations` | admin / department head / exam controller | one generic rule `match /{coll}/{docId}` |
| `questionBank/{id}` (+ `history`) | roles with question rights | `data` JSON string, `searchText`, `fingerprint`, `favoritedBy`; client loads the newest 1000 and searches in memory |
| `answerKeys/{b_<id>}` and `answerKeys/{p_<paper>_<item>}` | roles with key rights | separate protected collection |
| `questionPapers/{id}` (+ `items`, `versions`) | client | status workflow enforced by rules |
| `paperTemplates`, `questionTypes` | client | per-institution saved layouts / custom types |
| `notifications` | any member -> any member; functions | recipient reads |
| `activityLogs`, `exports`, `imports` | **client** | append-only by rule, but forgeable and optional |
| `subscriptions`, `payments` | functions only | `periodEnd` is written but never read anywhere |
| `systemSettings` | super admin | rule exists; no code reads it |
| `rateLimits` | functions only | default-deny |

Indexes: 11 composite indexes and 6 field overrides that switch indexing off for large JSON string fields — a good practice worth keeping.

The master prompt suggests 31 collection names. **12 exist and are used** (users, institutions, memberships, invitations, subscriptions, payments, questionBank, questionPapers, answerKeys, examinations, notifications, activityLogs), **1 exists only as a rule** (systemSettings) and **18 do not exist**: adminUsers, plans, transactions, templates, templateCategories, examSchedules, students, results, conversations, messages, supportTickets, announcements, auditLogs, featureFlags, aiUsage, invoices, coupons, uploads.

## 5. Cloud Functions inventory

| Function | Type | Does | Gaps |
| --- | --- | --- | --- |
| `generateQuestions` | callable | AI generation, 6 types, role check, rate limit, credit check, output normalisation | credits are checked before the call but charged after it (race window), no usage log, plan table hard-coded, Node 20 |
| `createPaymentSession` | callable | creates a `payments` doc and an SSLCommerz session | prices hard-coded, monthly only, `Math.random` in the transaction id |
| `sslcommerzCallback` | HTTPS | server-side validation, idempotent paid transition, sets plan | no expiry job, no refund/invoice, no `risk_level` check, any HTTP method accepted |
| `scripts/set-super-admin.js` | script | sets `{superAdmin:true}` | `setCustomUserClaims` replaces *all* claims |

## 6. Build, deploy, environments

- Public config is inlined at build time (`VITE_*`); `.env.production` is **committed** (Firebase web identifiers only — acceptable, but it needs a policy and a secret scanner).
- `VITE_AI_MODE=direct` is the default, so a default deployment has no server-side AI or credits.
- GitHub Pages cannot run server code, headers or rewrites beyond `404.html`; a Next.js application with route handlers, SSR or revalidation **cannot** be hosted there (see decision D3).
- No staging environment, no preview deployments, no release tags.

## 7. Dependency review

| Dependency | Concern | Action |
| --- | --- | --- |
| `xlsx` 0.18.5 (npm) | known prototype-pollution and ReDoS issues; fixed releases are not published to npm | move to a maintained build (SheetJS CDN tarball >= 0.20.2) or ExcelJS; cap file size |
| pdf.js 3.11.174 from cdnjs | no SRI; predates the fix for CVE-2024-4367 | bundle a current `pdfjs-dist`, set `isEvalSupported:false`, parse off the main thread |
| `firebase` 10.14 | older major | upgrade in Phase 2 behind emulator tests |
| React 18 / Vite 5 / Tailwind 3 | Next.js migration target is newer | decide majors at install time (D8) |
| `functions` engine Node 20 | upstream end-of-life in April 2026 | Node 22 |
| no lockfiles | non-reproducible installs; workflow falls back to `npm install` | commit lockfiles, use `npm ci` |
| Google Fonts via `<link>` | third-party request, needs internet to print | self-host (`next/font`) |

## 8. Verification evidence (what was actually run)

| Check | Result |
| --- | --- |
| `node --test tests/core.test.mjs` | 12 / 12 pass |
| `node --test tests/ai.test.mjs` | 30 / 30 pass |
| `node --test tests/export.test.mjs` | cannot run offline: `docx` is not installed here (`ERR_MODULE_NOT_FOUND`). This is a sandbox limit, not evidence of a defect |
| `node --check` on every plain `.js` file (src, functions, public) | all parse |
| JSX files, `vite build`, `npm install`, Firestore rules, emulators, SSLCommerz, Cloudinary, Gemini | **not run** — no network / no tooling |

> **Update 2026-11-18:** with `docx` and `jszip` made available offline, `tests/export.test.mjs` runs and passes (2/2); `esbuild` bundles `src/main.jsx` and parses all 68 JSX files. See `docs/phase-2/01-PHASE-2-PROGRESS.md`.

The project's own `PROJECT_DOCUMENTATION.md` is candid about the same limits; its feature matrix was cross-checked against the code and was found accurate, with the corrections listed in `02-FEATURE-ASSESSMENT.md`.

## 9. Code-quality observations

**Strong:** a clean services layer (all Firebase access in `src/services`), pure and unit-tested logic in `utils/`, a renderer-independent paper model shared by preview, print and Word, a rich-text renderer that escapes everything and whitelists styles/URLs, KaTeX with `trust:false`, defensive AI output normalisation, small autosave writes (only dirty items), good Firestore hygiene (no large arrays, JSON in non-indexed string fields).

**Weak:** three copies of the role matrix; plan data in three places; English-text i18n keys; 26 files touch `window`/`document`/`localStorage` (SSR-sensitive); no lint/format/CI test gate; accessibility is thin (79 `aria-*` attributes in total, 0 `tabIndex`, 1 `onKeyDown`; the modal has `role="dialog"` and Escape but no focus trap or focus return); React Hook Form and Zod cover only the auth and onboarding forms.

## 10. Assets to preserve verbatim (they carry the product's value)

`utils/*` (marks, numbering, sets, shuffle, bulkParse, importMap, richtext, question fingerprint), `question-types/*`, `preview/*` (paperModel, paginate, PaperDocument), `export/docxExport.js`, the editor components, the Tiptap configuration and KaTeX integration, the Bengali dictionary, `services/gemini.js` (369 lines, 30 tests — to be ported server-side), the paper-workflow logic in `firestore.rules`, and the 44 existing tests.
