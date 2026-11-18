# 02 — Existing Feature Assessment

EXAM MASTER · Phase 1 (Foundation)

Measured against the **EXAM MASTER Enterprise master prompt** (22 requirement sections). The repository's own `README.md` / `PROJECT_DOCUMENTATION.md` were written for an earlier, smaller master prompt; they were used as evidence, not as the yardstick.

**Legend**

- **Works** — implemented in code, reviewed statically. *Nothing has been run against a real Firebase project*, so "Works" means "complete in code", not "proven in production".
- **Partial** — usable but narrower than the spec.
- **Missing** — not in the repository.

Each row names the phase (from the master prompt's section 23) that closes the gap.

---

## 1. Scorecard

| Spec section | Verdict | One-line reason | Closed in |
| --- | --- | --- | --- |
| 1 Stack | Partial | React, Tailwind, Zustand, Tiptap, dnd-kit, Recharts, RHF+Zod, lucide present; **Next.js, shadcn/ui, Framer Motion, Admin SDK (server app)** absent | P2 |
| 2 Firestore / no Firebase Storage | Partial | Zero Storage SDK use (compliant); Cloudinary unsigned upload only; **no storage abstraction, no R2/S3, no signed upload/download** | P2, P6 |
| 3 Super Admin Control Center | Missing | A single `superAdmin` claim + a CLI script; no screens | P3 (+P4, P5) |
| 4 Teacher messaging | Missing | Only an in-app notification list | P6 |
| 5 Template marketplace (50) | Partial | 8 design presets + 1 blank layout; 42 templates to build; tier gating is UI-only | P4 |
| 6 Design Studio | Partial | Strong option panel; no drag-and-drop builder | P5 |
| 7 AI examination engine | Partial | 1 of 20 capabilities (generator) plus 4 partial | P5 |
| 8 Question bank | Partial | Strong base; client-side search over newest 1000; no approval, sharing, semantic search | P5 |
| 9 Examination management | Partial | Paper workflow only; ~3 of 22 listed capabilities | P7 |
| 10 Export | Partial | PDF via print dialog, Word, JSON, ZIP of sets work; no XLSX, OMR, QR, server PDF | P8 |
| 11 Collaboration | Partial | Roles, invitations, review workflow, versions; no comments, tasks, real-time | P6 |
| 12 Entitlements | Partial | Static plans, **browser-side limits only** | P2 → P4 |
| 13 Notifications | Partial | In-app + preferences; no email / browser push / broadcasts | P8 |
| 14 Analytics | Partial | Institution counts and charts, client-side | P8 |
| 15 Support center | Missing | — | P8 |
| 16 UI / UX | Partial | Responsive, dark/light, bn/en, skeletons, toasts; no command palette, global search, shortcuts, real a11y | P2 → P9 |
| 17 Security architecture | Partial | Good rules foundation; see `03-SECURITY-AUDIT.md` (23 findings) | P2, P3, P9 |
| 18 Database architecture | Partial | 12 of 31 suggested collections in use | all |
| 19 Backup / monitoring / performance | Missing / Partial | README note only; route code-splitting exists | P9 |
| 20 Code quality | Partial | Good layering; no lint/CI/lockfile | P2 |
| 21 Migration | — | Plan in `05-MIGRATION-PLAN.md` | P1 |
| 22 Testing | Partial | 44 logic tests; no rules/integration/e2e/security tests | every phase |

---

## 2. Detail by area

### 3. Super Admin Control Center (A–K)

| Area | Today |
| --- | --- |
| A Dashboard | Missing at platform level. An *institution* dashboard exists (counts, recent papers, activity for admins, 6-month chart) |
| B User management | Missing. A user edits only their own name/photo; institution admins manage *members* of their institution on the Team page (invite, change role, remove) |
| C Institution management | Partial. Self-service create/edit (name, type, address, phone, e-mail, website, logo URL); branches and departments are plain lists. No platform-level control, suspension, branding, usage |
| D Subscription management | Partial. 5 static plans in `constants/plans.js`; no create/edit/trial/renewal/expiry/upgrade/cancel/grace |
| E Payment management | Partial. SSLCommerz sandbox session + validated callback (never run end to end); no transaction screens, refunds, invoices, coupons, failed-payment tracking; no bKash/Nagad |
| F Template management | Missing at platform level. Institutions can save, duplicate, edit and delete *their own* layouts |
| G Website CMS | Missing (static landing page) |
| H AI management | Missing (model list is auto-discovered from the user's key; no provider, prompt, credit, cost or log management) |
| I Security center | Missing (no MFA, sessions, login history, lockout UI) |
| J System management | Missing (`systemSettings` rule exists, nothing reads it) |
| K Admin staff | Missing (`superAdmin` boolean claim only) |

### 4. Messaging — Missing (A–F)

Nothing to reuse except the notification list pattern and the Firestore security approach.

### 5. Templates

| Current id | Maps to spec # | Current gating | Spec gating |
| --- | --- | --- | --- |
| `classic` Classic Academic | 1 | free | Free |
| `modern` Modern Institutional | 2 | free | Free |
| `minimal` Premium Minimal | 3 | free | Free |
| `board` Board Examination | 9 SSC / 10 HSC (needs splitting) | **paid** | **Free** |
| `university` | 16 University Basic | **paid** | **Free** |
| `coaching` | 12 Coaching Model Test | **paid** | **Free** |
| `madrasa` | 11 Madrasa Examination | **paid** | **Free** |
| `training` | 19 Training Assessment | **paid** | **Free** |
| `custom` Custom Layout | base for "My templates" (not #50) | free | — |

So **8 of 50** exist as designs, **42 are new**, and five existing presets are *paid today but Free in the spec* (decision D4). Today a template is only a **visual design**; the spec asks for "separate design configuration and examination structure", so a `structure` (sections, marks, answering rules, instructions) must be added to the model.

### 6. Design Studio — what exists vs. spec

| Spec item | Today |
| --- | --- |
| Page sizes A4 / Legal / custom, orientation, margins | Works (also A5, Letter) |
| Fonts, font size, line height, colors | Works (separate font for Word) |
| Header layout, logo, institution/exam toggles, info layout | Works (layout presets, not a builder) |
| Footer text, page numbers (formats) | Works |
| Border, watermark (text), signature lines | Works (no image watermark, no institution seal) |
| Section style, question spacing, marks position, MCQ option columns | Works (columns per section) |
| Save custom designs | Works (`paperTemplates`) |
| **Drag-and-drop page builder, header/footer builders, logo placement, background, multi-column page layout, manual page breaks, brand kit, seal** | Missing |
| Live multi-page preview | Works (shared with print) |

### 7. AI engine (20 listed capabilities)

Works: question generator for 6 types (mcq, cq, short, broad, math, tf) with answers and explanations. Partial: chapter-wise, subject-wise, answer, explanation generation (as parameters of the generator); material-based generation from pasted text / `.txt`. **Missing (15):** paper generator, syllabus analyzer, difficulty balancer, marking-scheme generator, AI duplicate detector (a non-AI fingerprint duplicate check exists), quality checker, grammar checker, rewriter, translator, summarizer, Bloom mapping, classification, blueprint generator, exam review, AI multi-set generator (non-AI sets A–F exist). Review-before-save exists (drafts are editable) but there is **no "unverified AI content" flag** carried onto papers.

### 8. Question bank

Works: 20 question types, difficulty, marks, tags, filters, fingerprint duplicate detection, bulk import (CSV/XLSX/XLS/TXT/DOCX/PDF text), bulk export (JSON/CSV), history with restore, favorites, archive/restore, ownership (`createdBy`), bulk edit/delete. Partial: search (substring on `searchText`, **newest 1000 only**), chapters/topics (lists). Missing: approval workflow, institution/department sharing across tenants, semantic search, server-side pagination, unlimited custom categories beyond the lists.

### 9. Examination management (22 listed capabilities)

Works: exam list, academic sessions, paper workflow *draft → review → approved → published* with notes and version history. **Missing (19):** routine, calendar, subject/class/student assignment, seat plan, admit card, attendance, hall management, exam status, answer sheets, mark entry, result processing, GPA, grade/mark/tabulation sheets, result analytics, comparison, reports. There is no `students` data at all.

### 10. Export

Works: PDF through the browser print engine from the *same* renderer as the preview; Word (header grid, Bengali, MCQ columns, CQ marks, tables, signature lines, page-number fields); JSON; sets A–F (ZIP of Word files, print); answer-key print/Word. Partial: CSV (bank only); formulas become plain text in Word; Word lacks border and watermark; fonts must exist on the reader's machine. Missing: one-click/server PDF, XLSX export, OMR sheet, QR-verified papers, mathematical formulas as real Word equations.

### 11–15

- **Collaboration:** roles (8), invitations (not e-mailed), review notes, version history, shared templates and bank *within* one institution. Missing: comments, tasks, real-time editing/updates (only one `onSnapshot`, for the unread badge), shared workspaces across institutions.
- **Entitlements:** limits for users, papers, questions, exports/month, AI credits, advanced templates defined in code; checked only in the browser (see S-02).
- **Notifications:** in-app list, unread count, per-event preferences; created for review, approval, export, subscription activation.
- **Analytics:** dashboard counters and a few client-side bar charts over loaded data.
- **Support:** nothing.

### 16. UI / UX

Works: responsive layout (about 82 breakpoint-prefixed classes), drawer navigation on mobile, dark/light, Bengali/English, skeletons, empty states, toasts, confirm dialogs, install-to-home-screen. Missing: command palette, global search, keyboard shortcuts, motion system, shadcn/ui component base, accessibility work (focus trap, focus return, keyboard flows, contrast audit), per-locale number/date formatting beyond digits.

---

## 3. Where today's behaviour conflicts with the master prompt

| # | Today | Master prompt | Resolution |
| --- | --- | --- | --- |
| C1 | Limits enforced in the browser | Backend only | Server chokepoint in P2, full engine in P4 |
| C2 | AI runs in the browser with the user's key (default) | "Never expose API keys on the client side" | Server AI gateway; retire direct mode (D5) |
| C3 | Plans hard-coded (3 copies) | Dynamic plans in Firestore | `plans` collection seeded from today's 5 tiers |
| C4 | 5 presets locked behind paid plans | Same templates are Free | Follow the spec (D4) |
| C5 | PDF via print dialog; answer keys parked in `localStorage` | Reliable PDF; same logic for preview and export | Server PDF with the same React renderer (P8) |
| C6 | Unsigned Cloudinary preset in the browser | Signed uploads; private files via R2/S3 | Storage abstraction + signed flows |
| C7 | Client-written activity/export logs | Server-side audit logs | Admin-SDK audit writer, rules deny client writes |
| C8 | Bank loads 1000 docs and filters in memory | Server-side pagination + semantic search | Cursor queries + tokens + vectors (P5) |
| C9 | English-text i18n keys | Full bn/en localisation | Key-based messages, codemod from `bn.js` |
| C10 | `docx`/`xlsx`/`pdf.js` loaded in the browser | Secure, reliable export/import | Server-side import parsing and export workers |

## 4. Corrections and additions to `PROJECT_DOCUMENTATION.md`

The document is accurate about what was verified. Findings it does **not** mention:

1. `institutions.plan` gating for templates is UI-only (any user can write any `design.templateId`).
2. `subscriptions.periodEnd` is written but never read — **paid plans never expire**.
3. `users.status`, `systemSettings` and the `isSuper` flag exist but nothing uses them.
4. Whole papers **including answer keys** are copied into `localStorage` for printing.
5. Functions still default to `gemini-2.5-flash`, which the README itself says new projects can no longer use.
6. Any signed-in user (verified or not) can create unlimited institutions through the rules.
7. pdf.js is fetched from a CDN at runtime.
