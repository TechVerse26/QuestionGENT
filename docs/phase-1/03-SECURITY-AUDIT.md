# 03 — Security Audit

EXAM MASTER · Phase 1 (Foundation) · audited 2026-11-16

**Scope:** Firestore rules, Cloud Functions, client authorization, payments, AI, file handling, import/export, build and deploy configuration, dependencies.
**Method:** static review with file evidence; nothing was exploited, and nothing was run against a live Firebase project (no network in the audit sandbox). **Phase 1 changed no application code.**
**Severity:** *High* = practical abuse or real exposure; *Medium* = needs a precondition or limited blast radius; *Low* = hardening; *Info* = planned capability.

**Result: 23 findings — 6 High, 10 Medium, 6 Low, 1 Info.** No evidence of a Firebase Storage dependency (policy met).

---

## High

### S-01 · Possible shared Firebase project (`tvexam`) · **High — Critical if confirmed shared**
- **Evidence:** `.firebaserc` and `.env.production` hard-code project `tvexam`; the README deploy step is `firebase deploy --only firestore:rules,firestore:indexes`.
- **Risk:** Firestore rules and indexes belong to the *database*, not to an app. If another live app (for example the Tech Verse Exam site) uses this project, deploying these rules **replaces that app's rules** — everything not listed here becomes default-deny — and both apps share one Auth user pool and one `users` collection.
- **Fix:** confirm which apps use `tvexam`. If shared, give EXAM MASTER its own Firebase project (recommended) or a named Firestore database plus its own Auth pool. Do not deploy any rules or indexes from this repo until confirmed.
- **Phase:** before Phase 2 (decision D1).

### S-02 · Plan limits are enforced only in the browser · **High**
- **Evidence:** `src/services/planService.js:29-35` (`checkLimit`) is called from 10 UI sites; `firestore.rules` contains no limit logic; export counts come from client-written `exports` documents (`activityService.js:13-15`); template gating is `locked()` in `pages/Templates/index.jsx:51`; README §3c: "Plan credits are not applied in this mode".
- **Risk:** anyone with the (public) Firebase web config can write straight to Firestore and exceed papers/questions/members/exports limits, apply any paid template id, and use unlimited AI. Spec section 12 forbids this.
- **Fix:** every quota-consuming create goes through a server API (Admin SDK) that reads entitlements, checks and increments usage counters in a transaction, then writes; rules deny direct creates for those collections.
- **Phase:** chokepoint in P2, full dynamic engine in P4.

### S-03 · Unlimited institution creation without a verified e-mail · **High**
- **Evidence:** `firestore.rules:46-51` — `create` requires only `signedIn()`, `plan == 'free'`, `aiUsed == 0`, a name. `RequireAuth` blocks unverified users **in the UI only**.
- **Risk:** scripted creation of unlimited institutions; each starts with a fresh free quota (combined with S-02: quota farming), plus spam and storage cost.
- **Fix:** institution creation becomes a server operation (verified e-mail, per-user cap, rate limit, audit log); rule `create: false`.
- **Phase:** P2.

### S-04 · AI key held in the browser (default mode) · **High**
- **Evidence:** `services/aiKey.js` stores the user's Gemini key in `localStorage`; `aiService.js:10` defaults to `direct`; Google's free tier may use prompts for product improvement (README §3c).
- **Risk:** any XSS or malicious browser extension reads the key; no server-side quota, logging, cost control or content policy; conflicts with spec 3H ("never expose API keys on the client side").
- **Fix:** server-side AI gateway with platform-held keys, credit reservation, usage logs and prompt management; retire direct mode, or keep it only as a clearly labelled, off-by-default "bring your own key" (decision D5).
- **Phase:** P5 (gateway skeleton in P2).

### S-05 · pdf.js loaded from a CDN, outdated, no integrity pin · **High**
- **Evidence:** `src/import/parsers.js:9-21` injects `<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js">`; `getDocument({ data })` runs with default options.
- **Risk:** version 3.11.174 predates the pdf.js release that fixed **CVE-2024-4367** (arbitrary JavaScript through a crafted PDF font) unless `isEvalSupported` is disabled; a hostile PDF imported by a teacher would run in the app's origin and could read Firebase tokens and the AI key. No SRI hash; a CDN compromise would also reach every user. *(Verify the exact fixed version when upgrading.)*
- **Fix:** zero-regret now: pass `isEvalSupported: false`. Then bundle a current `pdfjs-dist` from npm, parse in a Web Worker or on the server, and drop the CDN with a CSP.
- **Phase:** hotfix in P2 start; proper fix P2/P5.

### S-06 · `xlsx` 0.18.5 from npm · **High**
- **Evidence:** `package.json` `"xlsx": "^0.18.5"`; `parsers.js:49-53` parses user-uploaded `.xlsx/.xls`. The project documentation already notes the package is outdated.
- **Risk:** known prototype-pollution (CVE-2023-30533) and ReDoS (CVE-2024-22363) issues; fixed builds are not published on npm. Untrusted spreadsheets are parsed in the browser.
- **Fix:** SheetJS 0.20.x from its official tarball, or ExcelJS / a minimal XLSX reader; enforce size and row caps; prefer server-side parsing in an isolated worker.
- **Phase:** P2 (swap), P5 (import hardening).

---

## Medium

### S-07 · Answer keys copied to `localStorage` for printing · **Medium**
- **Evidence:** `src/export/printExport.js:7-25` stores `{ paper, items, keys }` under `em-print-*`; stale entries are removed only when the *next* print starts (6-hour cut-off).
- **Risk:** keys and unpublished papers persist on shared computers and are exposed to any XSS.
- **Fix:** server-rendered PDF (P8). Until then: delete the entry as soon as `/print` reads it, and keep it in `sessionStorage`.

### S-08 · Audit and activity logs are written by the client · **Medium**
- **Evidence:** `firestore.rules:260-264` lets any member create `activityLogs` with arbitrary `action`/`meta`; `activityService.js:4-6` swallows failures; only four actions are logged.
- **Risk:** forgeable, skippable, incomplete audit trail; spec requires audit logging of important administrative operations.
- **Fix:** server-only `auditLogs` and `activityLogs` written by the Admin SDK with actor, role, IP, user agent, target, before/after hash; rules deny all client writes; immutable by design.
- **Phase:** P3.

### S-09 · `users/{uid}` accepts arbitrary fields from the owner · **Medium**
- **Evidence:** `firestore.rules:36-41` only pins `uid`; `authService.js:15` writes a `status: 'active'` field that nothing reads.
- **Risk:** any future logic that trusts `status`, plan, flags or counters stored on `users` is bypassable.
- **Fix:** allow-list owner-writable fields (`displayName`, `photoURL`, `prefs`, `updatedAt`); account state (suspended, plan, admin role) lives in server-owned documents and custom claims.
- **Phase:** P3.

### S-10 · No field-level validation in most rules · **Medium**
- **Evidence:** generic rule `firestore.rules:105-112`, templates/types/notifications/exports/imports (222-276) check ownership and role but not types, sizes or enums; `favoritedBy` is an unbounded array.
- **Risk:** oversized or malformed documents, cost and storage abuse inside a tenant, data-integrity bugs.
- **Fix:** per-collection validators (`is string && size() <= n`, enum membership, `affectedKeys().hasOnly(...)`, array size caps), mirrored by Zod schemas in the shared package.
- **Phase:** P2.

### S-11 · Rules have never been run or tested · **Medium**
- **Evidence:** `PROJECT_DOCUMENTATION.md` §1: "Rules were reviewed by hand, never run in the emulator"; `tests/` has no rules tests.
- **Risk:** a typo or a `get()` budget overrun (10 per request, 20 per batch) fails closed in production, or an over-permissive branch ships unnoticed.
- **Fix:** `@firebase/rules-unit-testing` suite on the Emulator Suite, tenant-isolation matrix (role x collection x operation x owner/other-tenant), run in CI on every change.
- **Phase:** P2 (gate for every later phase).

### S-12 · No App Check, no per-user rate limiting on writes · **Medium**
- **Evidence:** `firebase/config.js` initialises no App Check; `authz.js:24-35` rate-limits only `generateQuestions`.
- **Risk:** anyone can script the public Firebase endpoints (sign-ups, reads, writes, callable functions) at will; cost and abuse exposure.
- **Fix:** App Check (monitor, then enforce) for Firestore, Auth and callables; route-handler rate limiter (store-backed); budget alerts.
- **Phase:** P2 / P9.

### S-13 · No security headers or CSP · **Medium**
- **Evidence:** `vercel.json` contains only a rewrite; GitHub Pages cannot set headers; `index.html` has an inline script and third-party fonts.
- **Risk:** clickjacking, MIME sniffing, no script allow-list to contain the XSS and CDN issues above.
- **Fix:** Next.js middleware with a per-request CSP nonce, HSTS, `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`; self-host fonts and libraries.
- **Phase:** P2.

### S-14 · Payment lifecycle gaps · **Medium**
- **Evidence:** `functions/src/payments/sslcommerz.js`: prices hard-coded (line 16); transaction id uses `Math.random` (29); callback validates with SSLCommerz and is idempotent (good) but ignores `risk_level`, accepts any HTTP method, and sets a fixed 30-day period (66-69); `subscriptions.periodEnd` is never read anywhere, so **paid plans never expire**; no refund, invoice, reconciliation or webhook ledger. The file states it has never been run end to end.
- **Risk:** revenue leakage, disputes without records, possible replay or status confusion.
- **Fix:** subscription state machine (trialing, active, past_due, grace, expired, canceled), scheduled expiry/grace jobs, immutable transaction ledger, `crypto.randomUUID()` ids, strict method and origin checks, `risk_level` policy, reconciliation job, sandbox-recorded fixtures for tests.
- **Phase:** P4.

### S-15 · The permission matrix exists in three places · **Medium**
- **Evidence:** `constants/roles.js`, `firestore.rules:17-33`, `functions/src/security/authz.js:5-9` (only 3 of 8 roles).
- **Risk:** silent drift between what the UI shows, what rules allow and what the server allows.
- **Fix:** one source in a shared package; generate rule helper functions from it; add a test that compares all three.
- **Phase:** P2 / P3.

### S-16 · Membership rule edge cases · **Medium**
- **Evidence:** `firestore.rules:60-83`: `creatorBootstrap` lets the institution creator re-create their own `institution_admin` membership at any time; any admin may delete another admin; there is no "at least one admin" invariant and no ownership transfer.
- **Risk:** a demoted or removed creator regains admin; an institution can be left without an admin or hijacked by a rogue admin.
- **Fix:** membership changes go through the server with invariants (>= 1 admin, owner transfer, audit log); rules deny direct membership writes after bootstrap.
- **Phase:** P3.

---

## Low

### S-17 · Any member can create notifications for any other member · **Low**
- **Evidence:** `firestore.rules:248-258`. **Risk:** in-tenant spam or phishing text. **Fix:** server-side creation, fixed templates, rate limit. **Phase:** P8.

### S-18 · No lockfiles, no dependency or secret scanning · **Low**
- **Evidence:** no `package-lock.json` in root or `functions/`; the workflow falls back to `npm install`. **Risk:** non-reproducible builds and supply-chain exposure. **Fix:** commit lockfiles, `npm ci`, Dependabot, `npm audit` and gitleaks in CI. **Phase:** P2.

### S-19 · Functions runtime and script hygiene · **Low**
- **Evidence:** `functions/package.json` engine Node 20 (upstream end-of-life April 2026); `generateQuestions.js:8` defaults to `gemini-2.5-flash` (the README says new projects cannot use it); `set-super-admin.js:8` uses `setCustomUserClaims`, which **replaces every existing claim**. **Fix:** Node 22; model id from Firestore AI settings; a claims-merge helper. **Phase:** P2 / P3.

### S-20 · API-key restrictions and committed `.env.production` · **Low**
- **Evidence:** `.env.production` is committed (public Firebase identifiers only). **Risk:** the web API key's referrer/API restrictions and Auth authorized domains cannot be verified from the repository. **Fix:** verify in Google Cloud console; add a "no secrets in the repo" policy with a scanner. **Phase:** P2.

### S-21 · Rich-text images may point to any HTTPS host · **Low**
- **Evidence:** `utils/richtext.js:39,84` (`SRC_RE`). **Risk:** tracking pixels and IP disclosure to viewers, hot-linked images disappearing from old papers, cross-origin failures in Word export. **Fix:** new uploads only via the storage layer (Cloudinary/R2 host allow-list); keep legacy URLs readable. **Phase:** P6.

### S-22 · Unused Firebase Storage bucket setting · **Low**
- **Evidence:** `firebase/config.js:11` and `.env.production` carry the bucket name; no code uses it. **Risk:** none today, but it invites accidental use. **Fix:** remove the key, never provision Storage, and enforce with an ESLint `no-restricted-imports` rule plus a CI grep for `firebase/storage`. **Phase:** P2.

## Info

### S-23 · No MFA, session management, login history or lockout · **Info**
Not present, and not required for the current feature set; required by the master prompt for the admin area. Firebase Auth throttling applies by default. **Phase:** P3 (TOTP MFA for staff; confirm Identity Platform requirements and cost first).

---

## What is already good (keep it)

- Default-deny rules; tenant isolation through `memberships/{uid}_{institutionId}` documents; `institutionId` on every institution-owned document; list queries always filter by it.
- Answer keys in a **separate** collection with their own role set; paper edits locked after `draft`; status transitions validated in rules.
- Rich-text renderer: escapes every text node, whitelists colors, sizes, fonts and image sources; KaTeX with `trust:false`; editor with `allowBase64:false`.
- `generateQuestions`: secret via `defineSecret`, role check from the membership document (never from the client), rate limit, input clipping, strict output normalisation.
- SSLCommerz callback: never trusts the redirect — validates `val_id` server-side and compares transaction id, amount and currency; paid transition is transactional and idempotent.
- Invitations require a verified e-mail that matches; invitee can change only `status`, `acceptedBy`, `respondedAt`.
- Gemini key is sent in a header, not in the URL (and a test asserts it).
- No Firebase Storage usage anywhere.

## Traceability to master prompt section 17

| Requirement | Today | Target |
| --- | --- | --- |
| Firebase Auth, e-mail verification | Works (UI gate) | add server-side check on every API call |
| Secure sessions, CSRF | Missing (no cookies yet) | session cookies + Origin/token checks (P2) |
| Admin MFA | Missing | P3 |
| RBAC, permission-based authorization | Works for institution roles | platform roles + shared matrix (P3) |
| Institution data isolation | Works (rules, untested) | rules tests in CI (P2) |
| Server-side authorization, custom claims | Partial (3 functions; `superAdmin` only) | all privileged paths (P2-P3) |
| Rate limiting | AI function only | route-handler limiter + App Check (P2/P9) |
| Input validation, Zod | Partial (auth forms) | Zod on every API input (P2+) |
| XSS protection | Strong for rich text | + CSP (P2) |
| Secure file uploads, signed URLs | Partial / Missing | signed uploads and time-limited downloads (P2/P6) |
| Audit logging | Partial (client-written) | server-written immutable logs (P3) |
| Suspicious-activity detection | Missing | P3 / P9 |
| Secure payment verification | Partial | full lifecycle and reconciliation (P4) |
| API secret protection | Functions yes; browser AI key no | server only (P5) |

## Zero-regret fixes proposed for the first Phase 2 commit (not applied yet)

1. `isEvalSupported: false` in the pdf.js call (S-05).
2. Delete the print payload from `localStorage` right after `/print` reads it (S-07).
3. Remove `storageBucket` from config and `.env*` (S-22).
4. Commit lockfiles; switch the workflow to `npm ci` (S-18).
5. Change the functions default model to an env-supplied value; Node 22 (S-19).
6. Add the rules test harness before touching any rule (S-11).

## Not verified here (needs your Google Cloud / Firebase console)

Which rules are *currently deployed* in the live project; Authorized domains; web API key restrictions; whether Storage was ever enabled; Firestore location; billing plan and budget alerts; IAM members of the project; whether any production data already exists.
