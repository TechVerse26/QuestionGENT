# EXAM MASTER — Phase 1 (Foundation): Summary

Audited 2026-11-16 · scope: the whole `EXAM-QUESTION-GENERATOR-main.zip` (224 files) · **no application code was changed in Phase 1**

## Verdict

The repository is a **well-structured tenant core**: a paper builder with 20 question types, a question bank, one paged renderer shared by preview, print and Word export, a review workflow, 8 institution roles, protected answer keys and a careful Firestore rules foundation, plus 42 passing logic tests. It is **not yet a platform**: none of the 21 assessed requirement sections is complete (17 are partial, 4 are missing or nearly so), and the parts that make it an enterprise SaaS — Super Admin, messaging, dynamic subscriptions, the 50-template marketplace, exam management, server-side enforcement — do not exist.

**By the numbers:** templates 8 of 50 · AI capabilities 1 (+4 partial) of 20 · exam-management capabilities about 3 of 22 · admin areas 0 of 11 · collections in use 12 of 31 · rules tests 0 · Firebase Storage usage 0 (compliant).

**Nothing in this repository has ever been run against a real Firebase project** (rules, payments, Cloudinary, Gemini, build). The same is true of this audit: the sandbox has no network, so findings are static, with file evidence.

## Top risks (details in `03-SECURITY-AUDIT.md`)

1. **S-01** Project id `tvexam` may be shared with another live app; deploying these rules would replace that app's rules.
2. **S-02 / S-03** Plan limits live only in the browser, and anyone can create unlimited free institutions: quotas are bypassable.
3. **S-04** Gemini key kept in the browser by default.
4. **S-05 / S-06** Outdated pdf.js from a CDN and `xlsx` 0.18.5 parse user-supplied files.
5. **S-14** Payment flow never exercised end to end; **paid plans never expire** (`periodEnd` is never read).
6. **S-07** Answer keys are copied into `localStorage` for printing.

## What was audited and how

Every file was inventoried; all Firebase, functions, rules, payment, AI, import/export, routing, store and service code was read; counts and probes were scripted. Run offline: `core` tests 12/12 pass, `ai` tests 30/30 pass, every plain `.js` file parses. Could not run: `export` test (needs the `docx` package), JSX compilation, `vite build`, `npm install`, emulators, any external service.

## Decisions I need from you

| ID | Decision | Recommendation | Blocks |
| --- | --- | --- | --- |
| D0 | **Network for this workspace** (package registry, GitHub, Firebase emulator and Playwright downloads) — or you run commands locally and send me the output | Enable network access in settings | verification of every later phase |
| D1 | Is Firebase project `tvexam` used by any other live app? | Give EXAM MASTER its own staging + production projects | any deploy |
| D2 | Billing: Cloud Functions, schedulers, PITR need the Blaze plan | Enable Blaze with budget alerts | P2 functions, P4 webhooks, backups |
| D3 | Host for Next.js (needs a Node runtime; GitHub Pages cannot run it) | Vercel (already in use) | P2 |
| D4 | Template gating: spec makes Board, University, Coaching, Madrasa, Training **Free**; today they are paid | Follow the spec | P2 data seeding |
| D5 | Browser-key AI mode | Retire; server gateway only (or opt-in "bring your own key") | P5 |
| D6 | Backups without Firebase Storage | Custom exporter to R2/S3 (managed Firestore export needs a Cloud Storage bucket) | P2 backups |
| D7 | Private files and backups provider | Cloudflare R2 (S3-compatible) or AWS S3; account needed | P6 |
| D8 | Framework majors (Next, React, Tailwind, shadcn) | Chosen at install time after a compatibility spike | P2 |
| D9 | Accounts: e-mail provider, SSLCommerz credentials, bKash/Nagad merchant access, push (FCM), error tracking | Provide when the phase starts | P4, P6, P8 |
| D10 | Admin MFA mechanism | Firebase TOTP MFA (verify Identity Platform requirement and cost) | P3 |

## What Phase 2 starts with

1. Resolve D0–D3. 2. Safeguards (M0): record deployed rules/indexes, baseline counts, tag `legacy-v0.1.0`, run the first backup. 3. Repository hygiene and the rules test harness with characterization tests (M1). 4. Next.js shell around the existing app with a Playwright parity suite (M2). 5. Server foundation and the entitlement chokepoint (M3–M5).

## Documents

| File | Content |
| --- | --- |
| `01-REPOSITORY-AUDIT.md` | structure, stack, data model as built, functions, build/deploy, dependencies, verification evidence |
| `02-FEATURE-ASSESSMENT.md` | 21 sections scored, conflicts with the master prompt, template mapping |
| `03-SECURITY-AUDIT.md` | 23 findings with evidence, fixes, phases; strengths; traceability to section 17 |
| `04-TARGET-ARCHITECTURE.md` | Next.js layout, server layer, RBAC, entitlements, data model, storage, messaging, AI, payments, export, backups, env vars |
| `05-MIGRATION-PLAN.md` | stages M0–M8 with verification and rollback, backup/restore, risk register |
| `06-IMPLEMENTATION-ROADMAP.md` | phases 2–9, work packages, exit gates, needs from you |

---

## বাংলা সারসংক্ষেপ

**কী করা হয়েছে:** পুরো প্রজেক্টের ২২৪টি ফাইল অডিট করা হয়েছে (সোর্স কোড, ফায়ারবেস রুলস, ক্লাউড ফাংশন, পেমেন্ট, AI, এক্সপোর্ট/ইমপোর্ট)। Phase 1-এ কোনো কোড বদলানো হয়নি।

**বর্তমান অবস্থা:** পেপার বিল্ডার, প্রশ্নব্যাংক, ২০ ধরনের প্রশ্ন, প্রিভিউ/প্রিন্ট, Word এক্সপোর্ট, ৮টি রোল ও রুলসের ভিত্তি ভালো আছে। কিন্তু Super Admin, মেসেজিং, ডায়নামিক সাবস্ক্রিপশন, ৫০টি টেমপ্লেট (আছে ৮টি), পরীক্ষা ব্যবস্থাপনা, সাপোর্ট সেন্টার এখনো নেই। এই প্রজেক্ট কখনো সত্যিকারের Firebase-এ চালিয়ে টেস্ট করা হয়নি — আমার এই অডিটও কোড পড়ে করা (নেটওয়ার্ক বন্ধ ছিল)।

**সবচেয়ে বড় ঝুঁকি:**
- `tvexam` প্রজেক্ট অন্য কোনো লাইভ অ্যাপের সাথে শেয়ার হলে রুলস ডিপ্লয় করলে সেই অ্যাপের রুলস বদলে যাবে।
- প্ল্যানের লিমিট শুধু ব্রাউজারে চেক হয়, আর যে কেউ অসংখ্য ফ্রি প্রতিষ্ঠান বানাতে পারে — তাই লিমিট বাইপাস করা যায়।
- ব্রাউজারে Gemini key রাখা হয়; পুরনো `xlsx` ও pdf.js লাইব্রেরি ব্যবহারকারীর ফাইল পার্স করে।
- পেমেন্ট কখনো শেষ পর্যন্ত টেস্ট হয়নি, আর পেইড প্ল্যান কখনো এক্সপায়ার হয় না।

**তোমার সিদ্ধান্ত লাগবে (সবচেয়ে জরুরি ৪টি):** D0 নেটওয়ার্ক চালু করা (নইলে এখানে `npm install`/`next build`/এমুলেটর চলবে না), D1 `tvexam` প্রজেক্ট আলাদা কি না, D2 Blaze প্ল্যান, D3 Next.js হোস্টিং (Vercel সুপারিশ)।

**পরের ধাপ:** Phase 2 — আগে সেফটি নেট (ব্যাকআপ, রুলস টেস্ট, CI), তারপর Next.js শেল, তারপর সার্ভার সাইড এনফোর্সমেন্ট।

## Decision log (updated 2026-11-18)

| ID | Outcome |
| --- | --- |
| D0 | Network enabled in settings; this chat's sandbox has none — continue in a **new chat** |
| D1 | **Resolved:** `tvexam` is dedicated to EXAM MASTER |
| D2 | **Resolved:** no Blaze, no card, no spending → zero-cost architecture (`docs/phase-2/00-ZERO-COST-ADDENDUM.md`) |
| D10 | **Resolved:** own TOTP MFA (built and tested) |
| D3–D9, D11 | Open — see the addendum for the updated options (R2 is out; Backblaze B2 / Cloudinary instead) |
