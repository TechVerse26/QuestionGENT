# 06 — Implementation Roadmap (Phases 2–9)

EXAM MASTER · Phase 1 (Foundation)

The roadmap keeps the master prompt's nine phases and order. It adds **exit gates** (tests that must pass before the next phase starts) and four deliberate re-orderings of *work inside* the phases so that every phase stays compatible with the previous one.

**Effort legend (relative, not dates):** S = hours · M = 1–3 days · L = about a week · XL = several weeks of focused work.

**Definition of done for any feature:** its main workflow passes in the emulator/e2e suite · rules and server checks have tests · permissions enforced on the server · bn + en strings present · keyboard-reachable and responsive · new collections, rules, indexes and env vars documented · no fake data or dead buttons.

---

## Re-orderings inside the phases (and why)

1. **Safety net first (inside P2):** rules tests, CI, backups and the characterization suite come before any rule or data change — every later phase depends on them.
2. **Entitlement chokepoint in P2, not P4:** findings S-02 and S-03 (limit bypass, unlimited institutions) are too serious to wait. P2 delivers the server write path and usage counters on the *current* five plans; P4 delivers the dynamic plan engine and its screens on top.
3. **Admin areas ship with their engines:** P3 builds the admin shell and areas A (dashboard), B (users), C (institutions), G (website CMS), I (security), J (system), K (staff). Areas D (subscriptions), E (payments), F (templates) ship in P4 and H (AI) in P5 with the engines they control; the permission model from P3 already covers them.
4. **Storage abstraction skeleton in P2:** interface, Cloudinary signed upload and the uploads API; full file features (attachments, previews, voice) land in P6.

---

## Phase 1 — Foundation · **done**
Audit, feature assessment, security audit, architecture, migration plan, this roadmap (`docs/phase-1/`).

## Phase 2 — Core Architecture · XL
**Work packages**
- 2.1 Repository hygiene and CI (M1): lockfiles, lint (with the `firebase/storage` ban), `.env.example`, zero-regret fixes, backup/restore tooling v1, **rules test harness with characterization tests**. *(M)*
- 2.2 Next.js shell with the legacy bridge (M2) and the Playwright **parity suite**. *(L)*
- 2.3 Server foundation (M3): Admin SDK, session cookies, security headers and CSP (report-only first), rate limiter, audit writer, health endpoint. *(L)*
- 2.4 `shared` module: permission matrix, Zod schemas, constants; generated rule helpers and the matrix-equality test. *(M)*
- 2.5 Authentication: server-side e-mail-verification and account-status checks, session list/revoke, App Check in monitor mode, password policy. *(M)*
- 2.6 Additive data migration (M4) and the server chokepoint plus rules tightening (M5 R1–R3) on the current five plans. *(XL)*
- 2.7 Storage abstraction skeleton. *(M)*
- 2.8 UI foundation: shadcn base, token mapping, i18n infrastructure and codemod plan, command-palette shell. *(L)*

**Exit gate:** `next build` green · parity suite green · isolation matrix (role × collection × operation × own/other tenant) green · scripted bypass attempts (past a limit, forged log, 50 institutions, paid template id) **denied** · backup → restore drill on the emulator succeeds · CSP report-only clean · `firebase/storage` ban verified.
**Needs from you:** D0–D3, D5, D8; Firebase staging project and a service account for it.

## Phase 3 — Central Administration · XL
- 3.1 Platform RBAC: `adminUsers`, `adminRoles` (the 8 listed roles seeded, permissions editable), claims, recent-auth window, optional IP allow-list, TOTP MFA (D10), lockout. *(L)*
- 3.2 Server-written audit and activity logs, audit viewer. *(M)*
- 3.3 Admin shell and **A Dashboard** with scheduled aggregates. *(L)*
- 3.4 **B User management** (search, filters, profile, edit, suspend/activate, delete/restore, plan change, activity/login/usage history, permissions, notifications, support history). *(L)*
- 3.5 **C Institution management** (CRUD, suspend, members, departments, branches, teachers, subscription, usage, analytics, branding). *(L)*
- 3.6 **G Website CMS** (landing, sections, pricing/about/contact, FAQ, blog, announcements, testimonials, footer, SEO, branding, theme) with ISR revalidation. *(L)*
- 3.7 **I Security center**, **J System management** (config, feature flags, maintenance mode, health, exports), **K Staff** and optional restricted impersonation. *(L)*
- 3.8 Closing S-09 (users allow-list, `userAccounts`) and S-16 (membership invariants). *(M)*

**Exit gate:** a generated test proves **each staff role can do exactly what its permissions say and nothing else** · every admin mutation has an audit entry (asserted) · MFA/lockout flows tested · admin collections unreadable by clients (rules tests).
**Needs from you:** D10 decision; list of initial staff accounts.

## Phase 4 — Monetization and Templates · XL
- 4.1 **Dynamic subscription engine** (plans CRUD, pricing monthly/yearly, trials, grace, upgrade/downgrade, cancellation, custom/enterprise overrides, entitlements, renewal/expiry jobs) with admin area **D**. *(XL)*
- 4.2 **Payments** (area **E**): SSLCommerz hardening and sandbox e2e, immutable transaction ledger, refunds, invoices, coupons/discounts, gateway settings, revenue reports, failed-payment tracking; bKash and Nagad adapters behind flags. *(XL)*
- 4.3 **Template platform** (area **F**): global `templates` with versions, categories, publish/unpublish, pricing, plan access by rank, featured/popular, duplicate, preview, usage analytics; a template = **design + exam structure**. *(L)*
- 4.4 **Author the 50 templates** (20 free + 30 paid, separate design and structure each) and the marketplace UI (live and design preview, favorites, duplicate, customise, save as *My template*, use). *(XL)*

**Exit gate:** access matrix test returns **20 / 28 / 38 / 45 / 50** for Free / Starter / Professional / Institution / Enterprise · entitlement bypass suite denied · webhook replay tests on recorded sandbox fixtures · expiry/grace job tested · every template renders its sample paper on A4 without overflow (visual snapshots) · a plan created in the admin UI changes limits without a code change.
**Needs from you:** SSLCommerz sandbox (then live) credentials; bKash/Nagad merchant API access when available; D4; confirmation of prices, yearly discount and grace period.

## Phase 5 — Core Examination Platform · XL
- 5.1 **Question bank:** cursor pagination and token search, semantic search (confirm Firestore vector support first), approval workflow, institution/department sharing, category/class/chapter/topic management, server-side hardened bulk import (S-05, S-06), version history. *(XL)*
- 5.2 **AI engine:** gateway, prompt management, the 20 capabilities as registry tasks, review-before-publish and "AI draft" flags, usage logs; admin area **H** (providers, models, credits, per-plan limits, test console, error logs, cost monitor); retire direct mode (D5). *(XL)*
- 5.3 **Design Studio:** drag-and-drop page builder, header/footer builders, logo placement, seal, background, page columns, manual page breaks, brand kit, presets — on the existing single renderer. *(XL)*

**Exit gate:** bank stays responsive with a 50k-question fixture within a read budget · AI tasks pass contract tests against a mocked provider · credit-reservation concurrency test (no overspend) · no key reaches the browser (bundle scan) · every design change is reflected in the live preview and in PDF output (e2e).
**Needs from you:** Gemini key for the platform; allowed models and per-plan AI limits.

## Phase 6 — Communication and Collaboration · XL
- 6.1 Full storage providers (R2/S3 + signed Cloudinary), uploads API, previews, download permissions. *(L)*
- 6.2 Messaging core: direct and group chat, server-mediated send, realtime listeners, inbox, unread, receipts, replies, reactions, edit/delete, forward, pin, archive, mute, block, report. *(XL)*
- 6.3 Presence, typing, voice messages, search, in-app/browser/e-mail message notifications. *(L)*
- 6.4 Institutional, department, subject and exam discussions; cross-institution policy settings. *(M)*
- 6.5 Moderation: reports with snapshots, break-glass access, audit. *(M)*
- 6.6 Collaboration: workspaces, teams, comments, review notes, tasks, approval workflows, real-time updates, shared templates and banks. *(XL)*

**Exit gate:** privacy tests — non-member, staff/super-admin and blocked user are **denied** · cross-institution policy tests · 10k-message pagination fixture · upload tests (type, size, ownership, expiry, rejected magic bytes) · listener load test.
**Needs from you:** D7 (R2 or S3 account), D9 (e-mail provider), Firebase Cloud Messaging setup.

## Phase 7 — Examination Management · XL
- 7.1 Students, enrollment (import), exam sessions, schedules/routine, calendar, class and subject assignment, halls, seat plans, attendance. *(XL)*
- 7.2 Admit cards (PDF) and exam approval linked to the paper workflow. *(L)*
- 7.3 OMR system: sheet generation, key mapping, mark import (scanning is an optional extension — scope to confirm). *(L)*
- 7.4 Answer sheets, mark entry, result processing, grade scales and GPA, grade/mark/tabulation sheets, analytics and comparison, reports. *(XL)*

**Exit gate:** GPA/grade engine matches worked examples supplied by you · seat-plan generator constraints tested · admit-card and tabulation PDFs pass export checks · result import/export round-trip.
**Needs from you:** the grading scale(s) and GPA rules your institutions use; OMR scope decision.

## Phase 8 — Advanced Platform Features · L–XL
- 8.1 Export engine: server PDF using the preview's renderer, server DOCX, XLSX/CSV/JSON, ZIP of sets, QR verification, OMR export, real formulas in Word. *(XL)*
- 8.2 Analytics (user, revenue, exam, AI, template) on pre-aggregated data. *(L)*
- 8.3 Notification center completion: e-mail, push, broadcasts, announcements, preferences, history. *(L)*
- 8.4 Support center: tickets, categories, priority, assignment, replies, attachments, knowledge base, FAQ, feedback, bug and feature requests. *(L)*

**Exit gate:** Bengali PDF page count equals the preview on a sample set · DOCX renders in LibreOffice · QR verification page shows no question content · analytics aggregates equal raw counts on fixtures · e-mail and push delivered in a provider sandbox.

## Phase 9 — Enterprise Readiness · L
- 9.1 App Check enforcement, suspicious-activity detection, rate limits everywhere, penetration-style bypass suite, dependency and secret gates. *(L)*
- 9.2 Scheduled backups, integrity checks, restore drill, retention. *(M)*
- 9.3 Monitoring: Sentry, structured logs, health, slow-query detection, failed-job registry, budgets. *(M)*
- 9.4 Performance: bundle budgets, Lighthouse targets, revalidation, image optimisation, Firestore read audit. *(M)*
- 9.5 Accessibility audit and fixes to WCAG 2.2 AA; keyboard shortcuts and command-palette completion. *(M)*
- 9.6 White-label (institution branding, domains) and API access (keys, quotas). *(L)*
- 9.7 Final full test run (unit, integration, e2e, rules, security, responsive, payments, messaging, uploads, exports) and complete deployment documentation. *(M)*

**Exit gate:** all suites green in CI · restore drill passed · budgets/alerts live · accessibility report with no AA blockers · deployment guide verified by a clean-room install.

---

## How each phase is delivered here

Every work package is delivered as updated source plus a changelog, with an explicit **verified / not verified** table: what actually ran (tests, builds, emulators) and what could not. If this workspace still has no package-registry access (D0), code is delivered as *written but unverified* and the exact commands to verify it are listed; no feature is marked complete on that basis.

## Cross-cutting rules for every phase

Bengali and English strings for every screen · permissions enforced on the server · audit entries for important mutations · tests added with the feature · docs updated (collections, rules, indexes, env vars, deployment) · no secrets in git · no Firebase Storage · no placeholder data in production paths.
