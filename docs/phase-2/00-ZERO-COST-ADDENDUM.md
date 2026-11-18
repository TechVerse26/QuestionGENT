# Phase 2 — Zero-cost addendum to the architecture

EXAM MASTER · decided 2026-11-17/18 · supersedes the parts of `docs/phase-1/04-TARGET-ARCHITECTURE.md` and `05-MIGRATION-PLAN.md` that assume Cloud Functions, R2 or paid services.

## বাংলা সারসংক্ষেপ

আপনি জানিয়েছেন: Firebase প্রজেক্ট `tvexam` শুধু এই প্রজেক্টের, **Blaze প্ল্যান নেই, কার্ড নেই, কোনো খরচ করতে চান না।** এর মানে:

- **Cloud Functions ডিপ্লয় করা যাবে না** (Spark প্ল্যানে নেই)। তাই সব সার্ভার-লজিক Next.js এর সার্ভার রুটে (Firebase Admin SDK দিয়ে) যাবে; শিডিউল করা কাজ (ব্যাকআপ, সাবস্ক্রিপশন এক্সপায়ারি) চলবে GitHub Actions থেকে।
- **Firestore এর ফ্রি দৈনিক কোটা** (৫০ হাজার রিড, ২০ হাজার রাইট, ২০ হাজার ডিলিট) এখন আসল সীমা। বর্তমান ডিজাইনে প্রশ্নব্যাংক একবার খুললেই ১০০০ রিড খরচ হয়, ফলে দিনে মোটামুটি **১৫–২০ জন সক্রিয় শিক্ষক** হলেই কোটা শেষ। পেজিনেশন করলে এটা ~১২৫ জনে ওঠে (অনুমান)। কোটা শেষ হলে এখন অ্যাপ বাংলায় পরিষ্কার বার্তা দেখায়।
- **Cloudflare R2 বাদ** (R2 চালু করতে কার্ড লাগে)। প্রাইভেট ফাইল/ব্যাকআপের জন্য Backblaze B2 (ফ্রি ১০ জিবি) বা Cloudinary প্রাইভেট অ্যাসেট — আপনার সিদ্ধান্ত লাগবে।
- **Vercel Hobby শুধু নন-কমার্শিয়াল** ব্যবহারের জন্য। পেমেন্ট নেওয়া SaaS-এর জন্য Netlify ফ্রি বা Cloudflare বিবেচনা করুন (নিচে)।
- **Admin MFA:** Firebase-এর TOTP MFA-তে Identity Platform আপগ্রেড লাগে, তাই নিজস্ব RFC 6238 TOTP বানানো হয়েছে এবং আন্তর্জাতিক টেস্ট-ভেক্টরে যাচাই করা হয়েছে।
- **AI:** ফ্রি Gemini কী-র সীমা খুব কম, তাই সবার জন্য একটা প্ল্যাটফর্ম কী চলবে না। সুপারিশ: প্রতিটি শিক্ষকের নিজের ফ্রি কী সার্ভারে এনক্রিপ্ট করে রাখা (ব্রাউজারে নয়) + ছোট একটা প্ল্যাটফর্ম কোটা।

ফ্রি টিয়ার ডেভেলপমেন্ট, ডেমো ও ছোট পাইলটের জন্য ঠিক আছে; পাবলিক SaaS হিসেবে বড় হলে একসময় বিলিং লাগবেই। স্থাপত্য এমনভাবে রাখা হয়েছে যাতে পরে Blaze চালু করলে কিছু নতুন করে লিখতে না হয়।

---

## 1. What was verified (2026-11-18)

| Constraint | Finding | Source type |
| --- | --- | --- |
| Cloud Functions on the free (Spark) plan | Not available; paid Google Cloud products (Cloud Run, Pub/Sub, …) are not available on Spark | Firebase pricing pages (vendor) |
| Firestore free quota | 1 GiB stored, **50,000 reads/day, 20,000 writes/day, 20,000 deletes/day**, 10 GiB/month egress; resets around midnight Pacific (= about 1–2 PM in Bangladesh). Rule `get()`/`exists()` calls count as reads. Managed TTL deletes, point-in-time recovery, backups and restore are billable features | Firestore quotas and pricing pages (vendor) |
| Firebase TOTP MFA | Requires Firebase Authentication **with Identity Platform** (an upgrade); not part of the plain free Auth | Firebase docs (vendor) |
| Vercel Hobby | Personal, **non-commercial** use only; commercial use needs Pro | Vercel fair-use page (vendor) |
| Netlify free / Cloudflare Pages free | Described as allowing commercial use; Netlify free is credit-limited (about 300 credits/month, hard cap). *Confirm on each vendor's current page before relying* | third-party 2026 comparisons |
| Cloudflare R2 | A payment method must be on file to enable R2 | Cloudflare billing FAQ and incident record |
| Backblaze B2 | 10 GB free, S3-compatible, presigned PUT; the sign-up page states no credit card is required. *Confirm at sign-up* | Backblaze pages (vendor) |
| Cloudinary free | Authenticated/private delivery and expiring private download URLs exist; check the account's security settings for PDF/ZIP delivery. *Confirm in the dashboard* | vendor docs and community threads |
| Gemini free tier | Small per-project rate/daily limits and free-tier content may be used to improve Google products; limits change often — read them in Google AI Studio | third-party summaries |
| GitHub Actions free | Private repos: 2,000 Linux minutes/month; public repos: unlimited; scheduled runs are best-effort and are disabled in a repo with no activity for 60 days | GitHub docs (vendor) |

Sources: firebase.google.com/pricing · firebase.google.com/docs/firestore/quotas · cloud.google.com/firestore/pricing · firebase.google.com/docs/auth/web/totp-mfa · vercel.com/docs/limits/fair-use-guidelines · developers.cloudflare.com/billing/understand/faq · backblaze.com/sign-up/s3 · docs.github.com/actions (usage limits).

## 2. What changes in the architecture

| Phase 1 design | Zero-cost replacement | Notes |
| --- | --- | --- |
| Cloud Functions (triggers, schedulers, webhooks, workers) | **Next.js route handlers** with the Firebase Admin SDK + **GitHub Actions cron** | Service-account key lives only in host/CI secrets. Admin SDK, Firestore and Auth work on Spark; they just share the free quotas |
| Firestore triggers (usage counters, fan-out) | Done **synchronously inside the same server request** (transaction), plus a weekly reconcile job | Already the plan for quota-consuming writes |
| Scheduled expiry/grace, stats roll-ups, backups | GitHub Actions workflow → calls a protected route (`CRON_SECRET`) or runs a script | Free-minute budget is ample; remember the 60-day inactivity pause on public repos |
| Payment webhooks in Functions | Route handler on the Node host with gateway validation (same logic as today) | Needs a host with a public URL |
| Firebase TOTP MFA | Own TOTP (`src/server/security/totp.js`, RFC 4226/6238 vectors pass), secrets sealed with AES-256-GCM (`vault.js`), single-use recovery codes | Done and tested |
| R2/S3 private files | **Backblaze B2** (S3 API) or **Cloudinary authenticated assets**; same storage-provider interface | R2 is out (needs a card). Decision D7 |
| Backups to R2 + PITR + managed export | Encrypted gzip-NDJSON (`src/server/backup`, drill-tested) → private GitHub repo artifact and/or B2 | PITR and managed export need billing → unavailable |
| TTL policies, typing and presence docs in Firestore | **Dropped** for now: no typing indicators; "last seen" updated at most every 10 minutes while active | Per-minute heartbeats alone would burn the write quota with ~14 users |
| Server-side Chromium PDF | **Keep the existing browser print/PDF path**; revisit a server PDF only if a free Chromium-capable host exists | Phase 8 spike |
| Platform Gemini key for everyone | Server AI gateway + **per-user "bring your own key" vault** (encrypted server-side, never returned to the browser) + a small platform allowance | Keeps keys off the client (spec) while scaling free quotas per user. Decision D5 |
| Vercel (already configured) | Host-agnostic Next.js Node app; **Netlify free or Cloudflare** if you take payments; Vercel Hobby only while there is no revenue | Decision D3 |
| Email notifications | Firebase Auth's own emails (free) + a free-tier transactional email provider later | Decision D9 |

Everything keeps the master prompt's hard rules: JavaScript, Firestore primary, Firebase Auth, Admin SDK, **no Firebase Storage**, secrets only on the server. The requirement "Cloud Functions must be used" cannot be met without Blaze; the Functions code in `functions/` stays as reference and is ported into route handlers.

## 3. The free Firestore quota is the real capacity limit

Estimated reads per active teacher per day (assumptions: 3 dashboard opens, 2 question-bank opens, 3 paper-library opens, 2 paper edits; a mature institution with 1,000+ questions and 200 papers):

| | Today (legacy reads) | After pagination (Phase 5 design) |
| --- | --- | --- |
| Dashboard | 120 | 24 (one stats document) |
| Question bank | 2,000 (the list loads up to 1,000 documents each time) | 125 (25 per page) |
| Paper library | 600 | 75 |
| Open/edit a paper | 166 | 166 |
| Notification badge | 10 | 10 |
| **Total / teacher / day** | **≈ 2,900** | **≈ 400** |
| **Teachers per day within 50,000 reads** | **≈ 17** | **≈ 125** |

Writes (autosave, logs, notifications) are about 70 per teacher per day, so reads are the binding limit (about 285 teachers by writes). These are **estimates**; measure with the Firebase usage dashboard.

Consequences for the plan:

1. **Read-efficiency becomes a first-class requirement** (pagination, stats documents, `count()` aggregation, caching) and moves earlier than Phase 5 where possible.
2. **Quota exhaustion is a normal state.** The app now turns Firestore's "Quota exceeded" into a clear English/Bengali message (done: `src/utils/firebaseErrors.js` + Toast).
3. **Background jobs spend the same budget.** A full backup of 10,000 documents costs 10,000 reads (20% of a day). Use a weekly full backup and daily incremental backups (documents changed since the last run).
4. **Messaging is expensive on the free tier** (every delivered message is a read per open listener plus several writes). Phase 6 will ship text messaging without presence/typing, with small page sizes, and will be measured before anything is added.
5. Free tier is right for **development, demos and one-school pilots**. A public SaaS will outgrow it; enabling Blaze later keeps the same free allowances and removes the hard stop. Nothing here needs rewriting for that.

## 4. Updated decision register

| ID | Status | Decision |
| --- | --- | --- |
| D0 | Network | Enabled in settings, but **this chat's sandbox has none**; a **new chat** gets it. Optional extra domain for Firestore rules tests: `storage.googleapis.com` (only to download the emulator binary; unrelated to Firebase Storage) |
| D1 | **Resolved** | `tvexam` is only for EXAM MASTER. Recommended anyway: a second free Spark project (e.g. `tvexam-staging`) or emulators only for experiments, so a rules mistake never hits real users. Before touching rules, check whether production already holds real users/data |
| D2 | **Resolved** | No Blaze, no card, no spending → this addendum |
| D3 | Open | Host: Netlify free or Cloudflare (commercial use allowed) vs Vercel Hobby (non-commercial only) |
| D4 | Open (default: follow spec) | Board, University, Coaching, Madrasa, Training templates become Free |
| D5 | Open (recommended) | Retire browser-held keys; per-user server vault + small platform allowance |
| D6 | Proposed | Encrypted NDJSON to a private GitHub repo/artifact and/or B2; weekly full + daily incremental |
| D7 | Open | Private files: Backblaze B2 or Cloudinary authenticated assets (R2 needs a card) |
| D8 | Open | Framework majors chosen in the new chat with `npm view` and a compatibility spike |
| D9 | Open | Free email provider, SSLCommerz merchant credentials (usually business documents, not a card), bKash/Nagad access |
| D10 | **Resolved** | Own TOTP MFA (done) |
| D11 | New | AI credits: monthly reset (proposed) or lifetime (legacy `aiUsed`) |

## 5. How Phase 2 changes

The work packages in `docs/phase-1/06-IMPLEMENTATION-ROADMAP.md` stay, with these edits:

- **2.3 Server foundation:** route handlers only (no Functions); GitHub Actions cron added.
- **2.6 Data migration + chokepoint:** unchanged in intent; counters are updated inside the server transaction, with a weekly reconcile job instead of a trigger.
- **2.7 Storage abstraction:** providers are `cloudinary` and `s3` (B2); R2 removed.
- **New 2.9 Read-efficiency quick wins:** smaller default page sizes, "load more", stats document for the dashboard.
- **Phase 3 MFA:** the TOTP library is already done; remaining work is enrolment/verification endpoints and the admin UI.
- **Phase 6 messaging:** no presence/typing; measured quotas first.
