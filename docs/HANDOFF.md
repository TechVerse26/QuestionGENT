# HANDOFF — continue Phase 2 in a new chat

**Why a new chat:** the previous chat's workspace had no network (even with network enabled in settings, an existing chat keeps the sandbox it started with). A **new chat gets network access**, so `npm install`, `next build`, the emulators and Playwright can run and the remaining Phase 2 work can be *verified*.

## What to do

1. Start a **new chat** and upload `exam-master-phase2a.zip`.
2. Write: *"Phase 2 চালিয়ে যাও"* (the project, the 9-phase plan and the constraints are remembered; this file tells the assistant the exact state).
3. Optional (for Firestore rules tests): in network settings also allow `storage.googleapis.com` — it is only used to download the Firestore **emulator** program, unrelated to Firebase Storage.

## Hard constraints (do not break)

JavaScript only · Firestore primary · **no Firebase Storage** (tests enforce it) · **zero cost: no Blaze, no payment card, no Cloud Functions deploy** · secrets only on the server · never deploy rules/indexes before the staging/emulator checks · never delete or reset production data · tests before claiming a feature works.

## First actions for the assistant (in order)

1. `unzip`, then `npm install` (creates the lockfile — commit it), then `npm test` → **expect 121 passing**; `npm run check` → bundles.
2. `npx firebase-tools --version`, try starting the Firestore emulator (needs Java; if the download is blocked, say so and ask for the domain).
3. Finish **WP 2.1**: ESLint + Prettier (with a `no-restricted-imports` rule for `firebase/storage`), GitHub Actions CI (`npm ci`, tests, `npm audit`), rewrite `.env.example` for the Next.js era, **rules test harness with characterization tests of the CURRENT rules** (use the matrix in `src/shared/permissions` to generate the role × collection × operation cases).
4. **WP 2.2**: Next.js shell + legacy bridge (see `docs/phase-1/05-MIGRATION-PLAN.md` M2), then the Playwright parity suite. Chromium is preinstalled at `/opt/pw-browsers`.
5. **WP 2.3 / 2.5 / 2.6**: Admin SDK init, session cookies, wire `src/server/security/headers.js` (CSP in report-only first), CSRF, rate limiter, audit writer; server APIs for institution creation and quota-consuming creates using `src/shared/plans` + `src/shared/schemas`; then rules R1–R3.
6. **WP 2.9**: pagination / "load more" for the question bank and paper library; dashboard stats document.

## Open decisions to ask the user (short, one at a time)

D3 hosting (Netlify free or Cloudflare vs Vercel Hobby, which is non-commercial only) · D4 template gating · D5 AI key vault vs retiring browser keys · D7 private storage (Backblaze B2 or Cloudinary) · D11 AI credits monthly vs lifetime · whether production `tvexam` already holds real users/data · create a free staging Firebase project.

## Where things are

| Need | Look at |
| --- | --- |
| Audit, findings, architecture, migration, roadmap | `docs/phase-1/` |
| Zero-cost decisions and the free-quota maths | `docs/phase-2/00-ZERO-COST-ADDENDUM.md` |
| What is done / verified / not verified | `docs/phase-2/01-PHASE-2-PROGRESS.md` |
| Permissions (tenant + staff) | `src/shared/permissions` |
| Plans, entitlements, template access | `src/shared/plans`, `src/shared/templates` |
| Input validation | `src/shared/schemas` |
| MFA, vault, headers, CSRF | `src/server/security` |
| Backups | `src/server/backup` |
| The unchanged legacy app | `src/**` (everything else), `functions/` (reference only; not deployable on the free plan) |
| Original baseline | git tag `legacy-v0.1.0` |
