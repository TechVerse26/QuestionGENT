# 04 — Target Architecture

EXAM MASTER · Phase 1 (Foundation)

This is the design every later phase builds on. It keeps what already works (paper model, renderer, editors, tested logic, rules foundation), moves everything that must be trusted to the server, and stays inside the master prompt's hard rules: **JavaScript only, Firestore primary, Firebase Auth, Cloud Functions, Admin SDK, no Firebase Storage.** Decision IDs (D1…D10) refer to `00-PHASE-1-SUMMARY.md`.

> Library versions are deliberately **not pinned here**: the audit sandbox has no package-registry access, so versions and peer-dependency compatibility (Next/React/Tiptap/dnd-kit/Recharts/Tailwind/shadcn) are verified at install time in Phase 2 (D8).

---

## 1. Principles

1. **The server is the only authority** for money, limits, roles, admin actions and audit. The browser may read (rules-protected) and may perform low-risk own-data writes; it never decides entitlements.
2. **One source of truth** for permissions, plans/entitlements, question types and schemas — an isomorphic `shared` module — with generated Firestore-rule helpers and a test that proves they agree.
3. **Additive migration.** No destructive change to production data; every schema step is reversible (see `05-MIGRATION-PLAN.md`).
4. **Tenant isolation twice:** in rules *and* in server code.
5. **Every phase ships with tests and docs;** a feature is "done" only when its main workflow passes in the emulator/e2e suite.
6. **Cost-aware Firestore:** no hot documents, no large arrays, cursor pagination, aggregation counts, TTL for ephemeral data.

## 2. System context

```
 Browser  ── Next.js client components ── Firestore SDK (realtime READS, rules-protected)
    │                                              │
    │ HTTPS + session cookie                       │ (safe own-data writes only)
    ▼                                              ▼
 Next.js server (Route Handlers / Server Actions, Node runtime)
    │   uses Firebase Admin SDK (service account, server env only)
    ├──► Firestore + Firebase Auth (trusted writes, audit, entitlements, usage)
    ├──► Cloud Functions v2 ── triggers · schedulers · payment webhooks · queue workers · backups
    ├──► AI providers (Gemini first) · Payment gateways (SSLCommerz, bKash, Nagad) · Email · FCM push
    ├──► Storage providers behind one interface: Cloudinary (public images) · R2/S3 (private files, backups)
    └──► PDF renderer (headless Chromium) rendering the SAME React paper component as the preview
```

## 3. Technology decisions

| Concern | Decision | Why / rejected alternative |
| --- | --- | --- |
| Framework | **Next.js App Router, JavaScript/JSX** | Required. SSR/ISR for public pages, Route Handlers as the trusted API. Vite is removed once the legacy bridge is retired |
| UI | Tailwind (existing CSS-variable tokens kept) + **shadcn/ui in JS mode** + lucide + Framer Motion (respect `prefers-reduced-motion`) | Radix primitives fix the accessibility gaps (focus trap/return, keyboard) |
| Client state | Zustand (kept) | Already used; stores are small |
| Forms / validation | React Hook Form + **Zod everywhere** (client and server share schemas) | Today Zod covers 4 files only |
| Editor / DnD / charts | Tiptap, dnd-kit, Recharts (kept) | Core product value; verify peer compatibility in P2 |
| i18n | Key-based message files (`messages/en.json`, `bn.json`) via an App-Router-friendly i18n library; codemod converts the current English-text keys | Scales past ~1,000 strings, SSR-safe, plurals/numbers/dates |
| Auth | Firebase Auth (client) + **session cookies** minted by the Admin SDK | Enables server components, route handlers and CSRF-safe APIs |
| Database | Firestore (primary) | Required |
| Files | Storage provider abstraction: Cloudinary + S3-compatible (R2 or S3) | Firebase Storage forbidden |
| PDF | Headless Chromium rendering the shared React renderer | One layout engine for preview and PDF; React-PDF would be a second engine with Bengali-shaping risk |
| DOCX / XLSX | `docx` (kept, runs on server too) / ExcelJS | Maintained; avoids the vulnerable `xlsx` npm build |
| Testing | Node test runner → Vitest for units, `@firebase/rules-unit-testing` on the Emulator Suite, Playwright (+ axe) for e2e, responsive and accessibility | Spec section 22 |

## 4. Repository layout (single Next.js app + functions)

```
/
  src/
    app/
      (marketing)/        SSR/ISR: landing, pricing, about, contact, faq, blog, legal  (CMS-driven, tag-revalidated)
      (auth)/             login, register, verify-email, forgot-password
      (app)/app/…         tenant workspace: dashboard, papers, question-bank, templates, studio, ai,
                          exams, results, messages, workspace, support, notifications, team, analytics,
                          subscription, settings
      (admin)/admin/…     Super Admin Control Center: own layout, own guard, own session policy
      api/…               route handlers: auth, uploads, ai, payments, exports, messages, admin, cron
    middleware (or proxy, per Next major)   CSP nonce, security headers, cookie presence check, locale
    features/<name>/      components · hooks · client services · schemas · store   (feature-local)
    components/ui/        shadcn primitives          lib/   firebase-client, i18n, small utils
    server/               SERVER-ONLY (guarded with the `server-only` package)
      auth/ authz/ entitlements/ usage/ firestore/ storage/ ai/ payments/ email/ audit/
      ratelimit/ exports/ notifications/ backup/
    shared/               isomorphic, pure, no Firebase/Next imports: permissions matrix, entitlement
                          evaluator, Zod schemas, constants, question-type registry, paper model, utils
  messages/               en.json, bn.json
  functions/              Cloud Functions v2 (Node 22), bundled with esbuild so it can import src/shared
  rules/                  firestore.rules sources + generator (helpers generated from src/shared)
  tests/                  unit · rules · integration · e2e
  scripts/                migrations · seeders · backup/restore · maintenance
  docs/
```

**Import rules (enforced by ESLint):** `shared` imports nothing platform-specific; `server/*` is never imported by client code; `features/*` may use `shared` and `components/ui` but not each other's internals; only `server/storage` may import S3/Cloudinary SDKs; **nobody may import `firebase/storage`** (also a CI grep).

## 5. Where logic runs

| Runs in | What |
| --- | --- |
| **Route Handlers / Server Actions** (request/response, privileged) | sessions, institution creation, every quota-consuming create, member/role changes, invitations, signed upload/download URLs, AI calls, payment-session creation, export and PDF generation, message send/edit/delete, all admin operations, audit writes |
| **Cloud Functions v2** (event-driven, scheduled; needs Blaze — D2) | Firestore triggers (usage-counter backstop, notification fan-out, denormalisation), schedulers (subscription expiry/grace, backups + integrity checks, retention/TTL cleanup, health snapshots, stats roll-ups), payment webhooks (kept independent of web deploys), e-mail/push workers with retries |
| **Browser** | UI, realtime reads, autosave of own drafts, optimistic UI |

## 6. Authentication, sessions, authorization

**Sessions.** Browser signs in with Firebase Auth → `POST /api/auth/session` with the ID token → server checks `emailVerified` (password users) and account status → `createSessionCookie` → cookie `__Host-session` (`HttpOnly; Secure; SameSite=Lax; Path=/`). Tenant users: days; staff: hours, `checkRevoked: true`, recent-sign-in required for sensitive actions. The middleware only checks that a cookie exists (Edge cannot run the Admin SDK); route handlers and server components fully verify.
**CSRF.** SameSite plus an `Origin` check and a custom header on every mutating handler; webhooks are exempt and authenticated by provider validation.
**Sessions list / revoke.** `users/{uid}/sessions` (device, UA, IP hash, last seen) with revoke-all via `revokeRefreshTokens`.

**Two permission scopes**

| Scope | Roles | Stored in |
| --- | --- | --- |
| Tenant | the existing 8 institution roles (+ custom roles later) | `memberships/{uid}_{institutionId}` (unchanged) |
| Platform | Super Admin, Platform Admin, Finance Admin, User Support Admin, Template Manager, Content Manager, Technical Admin, Analytics Manager | `adminUsers/{uid}` → `roleId`; permissions in `adminRoles/{roleId}` (seeded, editable by Super Admin) |

Permission strings are namespaced (`users.suspend`, `plans.write`, `payments.refund`, `templates.publish`, `cms.write`, `ai.configure`, `security.read`, `system.write`, `staff.manage`, `analytics.read`, `support.reply`, `moderation.review` …). `can(actor, permission, resource)` lives in `shared` and is called by every handler. Custom claims carry only `{ adm, ar (role id), pv (permissions version) }` (claims are size-limited); the permission list is resolved server-side and cached.
**Admin data never goes through client rules:** `adminUsers`, `adminRoles`, `auditLogs`, `securityEvents`, `transactions`, `invoices`, `webhookEvents`, `moderationAccess` are `allow read, write: if false` for clients; the admin UI calls permission-checked handlers.
**Admin hardening:** MFA (D10), optional IP allow-list, recent-auth window, account lockout, short staff sessions, suspicious-activity events.
**Impersonation (only if built):** view-as session, requires `users.impersonate` + ticket id + reason, ≤ 30 min, visible banner for the impersonated session, never for Super Admin accounts, no access to messages or payment secrets, every request tagged `actingAs` and audit-logged.

## 7. Dynamic subscription and entitlement engine

**Collections**

- `plans/{planId}` — `name{en,bn}`, `status` (active/inactive/archived), `visibility` (public/private/custom), `rank`, `pricing{monthly, yearly, currency, trialDays, graceDays}`, `limits{ users, papers, questions, aiCredits, exportsPerMonth, storageMB, institutions, teacherSeats, messagesPerDay, customTemplates, apiCallsPerDay … }` (`-1` = unlimited), `features{ advancedAnalytics, collaboration, apiAccess, whiteLabel, prioritySupport … }`, `templateAccess{ mode: rank|explicit, maxRank, include[], exclude[] }`. **Seeded with exactly today's five tiers** (Free, Starter, Professional, Institution, Enterprise); nothing in code counts plans.
- `subscriptions/{institutionId}` — `planId`, `status` (trialing, active, past_due, grace, expired, canceled), `period{start,end}`, `cancelAtPeriodEnd`, `billingCycle`, `overrides{limits,features}` (custom/enterprise), `lastPaymentId`.
- `usage/{institutionId}` (server-only) — counters (questions, papers, members, storageBytes) plus `months/{yyyymm}` (exports, aiCredits, messages).

**Enforcement flow** (every quota-consuming action): handler → verify session → load membership → `resolveEntitlements(plan, subscription)` → **transaction:** check `usage + delta <= limit`, increment usage, perform the write → audit. Over-limit returns `{ code: 'LIMIT_EXCEEDED', key, limit, used }`. A Firestore trigger recounts with aggregation queries nightly to correct drift. Rules deny direct client *creates* on quota-consuming collections once the client migration is complete.
**Downgrade / expiry policy:** nothing is deleted; over-limit tenants can read and export but cannot create more.
**Template access:** `plan.rank >= template.minRank` — higher tiers automatically include lower ones (Free 20 → Starter 28 → Professional 38 → Institution 45 → Enterprise 50).

## 8. Data model additions

Conventions for every tenant document: `institutionId`, `createdBy`, `createdAt`, `updatedAt`, `schemaVersion`; soft delete with `deletedAt/deletedBy`; random 16-char ids (existing `newId`), deterministic ids only where needed (`{uid}_{institutionId}`). Rich/large JSON stays in non-indexed **string** fields (existing practice) to avoid index explosion and nested-array limits.

| Area | Collections (subcollections in brackets) | Writer |
| --- | --- | --- |
| Identity | `userAccounts/{uid}` (status, suspension), `users/{uid}/sessions`, `securityEvents` (TTL), `adminUsers`, `adminRoles` | server |
| Audit | `auditLogs` (actor{uid,type,role,actingAs}, action, target, diff-hash, ip, ua, requestId), `activityLogs` (tenant-visible, server-written) | server, append-only |
| Billing | `plans`, `subscriptions`, `usage`, `payments` (kept), `transactions` (immutable ledger), `invoices`, `coupons`, `webhookEvents` (idempotency) | server / functions |
| Templates | `templateCategories`, `templates [versions]`, `users/{uid}/favoriteTemplates`, `paperTemplates` (kept: "My templates", gets `sourceTemplateId`) | staff via API |
| CMS | `cmsPages`, `blogPosts`, `faqs`, `testimonials`, `announcements`, `siteSettings/public` | staff via API; ISR-cached |
| AI | `aiProviders`, `aiPrompts [versions]`, `aiUsage` (TTL), `aiUsageDaily` | server |
| System | `featureFlags`, `systemSettings/{public,private}`, `healthChecks`, `backups` (manifests), `jobs` (failures) | server / functions |
| Files | `uploads` (institutionId, ownerId, provider, key, mime, size, visibility, status, refs) | server |
| Messaging | `conversations [members, messages [reactions], pins, typing]`, `userBlocks/{uid}/blocked`, `reports`, `presence`, `moderationAccess` | see section 10 |
| Collaboration | `workspaces [members, tasks, comments]`, `reviews` | server + rules |
| Exams | `examSchedules`, `halls`, `seatPlans`, `students`, `enrollments`, `attendance`, `answerSheets`, `marks`, `results`, `gradeScales` | roles via API |
| Support | `supportTickets [replies]`, `knowledgeBase`, `feedback` | users + staff |
| Question bank (extended) | `questionBank` gains `searchTokens[]`, `embedding` (vector, if Firestore vector search is confirmed in P5), `approval{status,by,at}`, `sharing{scope}`, `ai{…}` | role via API |

**Firestore limits designed for:** 1 MiB per document; about 1 sustained write/second per document (so counters are written inside bulk transactions, not per row; shard only if measured); 500 writes per batch and 10/20 rule `get()` calls per request/batch; `in` / `array-contains-any` limited to 30 values; TTL policies for typing indicators, security events and AI usage logs; `count()` aggregation instead of scanning; every list is cursor-paginated (`startAfter`) with an explicit composite index checked into `firestore.indexes.json`.

## 9. Storage provider abstraction

```js
// src/server/storage/provider.js  (interface)
createUploadTarget({ key, contentType, maxBytes, visibility })  // -> { url, method, headers | fields, expiresAt }
createDownloadUrl({ key, expiresIn, filename })                  // -> time-limited URL
headObject(key)  deleteObject(key)  copyObject(from, to)
```

Providers: `cloudinary` (public images, logos, avatars — **signed** uploads generated by the server; the existing unsigned preset keeps working during migration) and `s3` (Cloudflare R2 or AWS S3 via the S3 API — private attachments, exports, backups).
**Flow:** client asks `POST /api/uploads` (type, size, name) → server checks permission, entitlement (`storageMB`), MIME/extension allow-list and size cap → creates `uploads/{id}` with `status: pending` → returns a signed URL → client uploads directly → `POST /api/uploads/{id}/complete` → server `headObject`s, verifies size and sniffs magic bytes → `status: ready` (or deletes and marks `rejected`). Downloads: authorise against the `uploads` document, then issue a 5–15 minute URL; non-image types are served as attachments.
Only metadata (owner, size, mime, permissions, references) lives in Firestore — never files or Base64. *R2 presigned URLs are PUT-based: sign the content type and declared length and verify by HEAD after upload instead of relying on POST policies.* A malware-scan hook (queue + scanner) is an optional later addition.

## 10. Messaging architecture (Phase 6)

- **Model.** `conversations/{cid}` (`type` direct/group/channel, `participantIds` (<= 200), `institutionId?`, `scope` institution/department/subject/exam/private, `title`, `lastMessage{snippet,senderId,at}`, `lastMessageAt`, settings, rules) · `members/{uid}` (role owner/admin/moderator/member, `lastReadAt`, `lastDeliveredAt`, `muted`, `archived`, `pinned`) · `messages/{mid}` (`senderId`, `type`, `body` <= 4,000 chars, `replyTo`, `attachments[uploadId]` <= 10, `editedAt`, `deletedAt` tombstone, `clientId` for idempotency) · `messages/{mid}/reactions/{uid}` · `pins`.
- **Inbox query:** `participantIds array-contains me` ordered by `lastMessageAt desc`, cursor-paginated. Unread = `lastMessageAt > member.lastReadAt`, with an exact count via `count()` only for visible rows (capped at "99+") — avoiding per-message fan-out writes.
- **Messages:** newest 30 with a realtime listener, older pages by cursor; never an array of messages inside one document.
- **Writes go through the server** (`/api/messages`): membership, block list, cross-institution policy, rate and plan limits, attachment ownership, text sanitising, then an Admin-SDK write that also updates `lastMessage`. Rules make `conversations/**` **read-only for clients** except a member's own small state fields. Clients still receive everything through Firestore realtime listeners.
- **Presence / typing:** throttled heartbeat doc (`lastSeen`, user-controllable visibility) and short-lived typing docs with a TTL field; a cost estimate and a Realtime Database alternative are documented before building (not a blocker).
- **Receipts:** derived from member `lastDeliveredAt/lastReadAt` — no per-message flags.
- **Privacy (spec 4F):** rules have **no staff or super-admin exception** for `conversations/**`; the admin console cannot list or open conversations. Abuse reports store a *snapshot* of the reported messages, reviewable by `moderation.review`. Any wider investigation needs a `moderationAccess` record (reason, scope, expiry, second approver), is performed only through a logging endpoint and is fully audit-logged. *Honest limit:* messages are not end-to-end encrypted; people with Google Cloud/Firebase console access could technically read them, so IAM is least-privilege and Data Access audit logging is enabled.
- **Search:** conversation search by title/participants; message search by per-conversation token prefixes first; an external search service only if measured need appears.

## 11. AI gateway (Phase 5, skeleton in Phase 2)

Pipeline: permission `ai.use` → entitlement + **credit reservation** (transaction on `usage`) → per-user and per-institution rate limit → prompt build from versioned `aiPrompts` (variables escaped; study material fenced as data) → provider call (timeout, retry, model fallback — logic ported from the tested `services/gemini.js`) → **Zod-validate** the output → drafts saved with `ai{generated, model, promptVersion, reviewStatus:'unreviewed'}` → credits settled (refunded on failure) → `aiUsage` log (tokens, latency, estimated cost, status, error code).
Rules of the road: keys only in server secrets; models and per-plan allow-lists in `aiProviders`; AI output is **never** published as verified — papers containing unreviewed AI questions show a warning and need a reviewer to confirm before `published`. The 20 capabilities are tasks in one registry (prompt + schema + UI), not 20 bespoke endpoints.

## 12. Payments

Adapter interface `createSession / handleWebhook / verify / refund`; SSLCommerz adapter ported from the existing function; bKash and Nagad adapters are written behind feature flags and enabled only when official merchant credentials exist (never simulated). Strict state machine (`pending → paid | failed | canceled`, `paid → refunded`), immutable `transactions` ledger, `webhookEvents` for idempotency, `crypto.randomUUID()` ids, amount/currency/tran-id match plus the gateway's risk signal, scheduled reconciliation, invoices with a transactional counter, coupons redeemed atomically with session creation, refunds by `payments.refund` staff with audit. Nothing ever marks a payment successful without gateway validation.

## 13. Export engine (Phase 8)

- **PDF:** a render route `/render/paper/[id]` (short-lived signed token, server-side authorisation) draws the **same** paged React component used by the live preview; headless Chromium prints it (`preferCSSPageSize`, backgrounds on, fonts self-hosted and awaited). Results are cached by content hash and delivered by signed download. Chromium host (serverless function vs a container service) is chosen after a Bengali-fidelity spike (D3/D2). The browser print path stays as a fallback.
- **DOCX:** keep `docx`; also generate server-side for ZIP of sets; evaluate LaTeX → MathML → Word equations for real formulas.
- **XLSX/CSV/JSON:** ExcelJS; answer keys, marks, tabulation sheets.
- **OMR:** printable bubble sheet generated by the same renderer (registration marks, set and roll grids) plus a machine-readable key; image scanning is a later, optional extension.
- **QR-verified papers:** `paperVerifications` record with a random code and content hash; footer QR → public `/verify/[code]` (institution, title, version, status — never questions).

## 14. Notifications

One `notify()` service: in-app document + channel routing by user preference — e-mail (provider adapter, queued with retries and a dead-letter record), browser push (FCM tokens per device), daily digest — in Bengali or English. Admin broadcasts and institution announcements target audiences, can be scheduled, and keep delivery logs.

## 15. Super Admin Control Center

`/admin` has its own layout, navigation and guard; every route declares its permission, every handler re-checks it, and the UI only mirrors it. Areas map one-to-one to spec 3A–3K. Tables use server-side cursor pagination, filters and CSV export. Dashboards read **pre-aggregated** documents (`statsDaily`, `revenueDaily`) written by schedulers rather than scanning collections live. All writes produce audit entries.

## 16. UI, i18n, accessibility

Existing color tokens are mapped onto shadcn CSS variables (light/dark preserved); command palette, global search and keyboard shortcuts are added in P2/P9; modals/menus move to Radix (focus trap, focus return, ARIA); target **WCAG 2.2 AA**, verified with axe inside Playwright; skip links, visible focus, reduced-motion, touch targets >= 44 px. Public pages are server-rendered with locale-aware metadata; fonts are self-hosted.

## 17. Observability, backups, performance

- **Errors/logs:** Sentry (client + server) with request ids; Cloud Logging for functions; `/api/health` and a scheduled `healthChecks` snapshot (Firestore, Auth, storage providers, AI provider, queue depth); slow-query timing wrapper (log > 500 ms); failed-job registry; budget and quota alerts.
- **Backups (no Firebase Storage):** nightly job streams collections page by page to gzip-NDJSON, encrypts (AES-256-GCM, key outside Firestore), uploads to a private R2/S3 bucket with a manifest (counts + SHA-256). Integrity job re-verifies hashes and compares counts with `count()` aggregations; a monthly restore drill targets the emulator or a scratch project; Firestore point-in-time recovery is enabled as a complement. *Managed Firestore export requires a Cloud Storage bucket, so it is optional and only with your approval (D6).*
- **Performance:** server components for public pages with tag-based revalidation, route-level code splitting, lazy heavy editors, image optimisation, cursor pagination, no unbounded listeners, Firestore persistent cache kept for the editor.

## 18. Testing and CI

Gates on every pull request: lint (including the `firebase/storage` ban), unit tests (existing 44 + new), **rules tests on the emulator**, integration tests for handlers and functions, secret scan, dependency audit, build. Nightly/pre-release: Playwright e2e (main workflows per phase), responsive (phone/tablet/desktop), axe accessibility, payment-webhook replay with recorded sandbox fixtures, export fidelity checks (Bengali PDF page count equals preview, DOCX renders), messaging privacy tests (a non-member and a staff user must be denied).

## 19. Environment variables and secrets (to be documented in `.env.example` in Phase 2)

| Name | Scope | Where |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY/AUTH_DOMAIN/PROJECT_ID/MESSAGING_SENDER_ID/APP_ID` | public | host env (no storage bucket) |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_USE_EMULATORS`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | public | host env |
| `FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` (or base64 JSON) | server secret | host secret store |
| `CLOUDINARY_API_KEY/API_SECRET` | server secret | host secret store |
| `S3_ENDPOINT/REGION/ACCESS_KEY_ID/SECRET_ACCESS_KEY`, `S3_BUCKET_PRIVATE`, `S3_BUCKET_BACKUP` | server secret | host + functions |
| `GEMINI_API_KEY` | server secret | host + functions secret |
| `SSLC_STORE_ID/STORE_PASS/LIVE`, later `BKASH_*`, `NAGAD_*` | server secret | functions secret |
| `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM` | server secret | host + functions |
| `FCM_VAPID_KEY` (public), `FCM` service credentials | mixed | host env |
| `SENTRY_DSN` | public/server | host env |
| `CRON_SECRET`, `BACKUP_ENCRYPTION_KEY`, `ADMIN_IP_ALLOWLIST` (optional) | server secret | host secret store |

No secret ever uses a `NEXT_PUBLIC_` prefix; `.env*` files except `.env.example` stay out of git; a secret scanner runs in CI.

## 20. Environments and hosting

`local` (emulators) → `staging` (**separate Firebase project** + preview deployment; all migrations rehearsed here with a copy of production data) → `production`. The Next.js app needs a Node-capable host (D3): GitHub Pages cannot run route handlers, SSR or revalidation, so it is retired as a production target. Region choices (Firestore location is fixed at creation; host and functions regions close to Bangladesh users) are recorded in `docs/deployment.md` in Phase 2.
