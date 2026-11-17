# EXAM MASTER: project documentation

This file says what exists, what was checked, and what is still missing. Nothing here claims more than what was done.

## 1. What was verified, and what was not

The project was written in an environment without internet access, so `npm install`, `vite build` and Firebase could not be run.

| Verified (really executed) | How |
| --- | --- |
| Core logic: marks, answering rules, numbering, bulk MCQ parser, table import mapping, set shuffling, duplicate detection, paper model, roles, pagination | 14 Node unit tests (`npm test`), all passing |
| Every source file parses and all local imports/exports resolve | esbuild bundled the whole of `src/` with no errors |
| Paged preview and print path | Headless Chromium: pages are exact A4 / Legal / landscape boxes, content never overflows a page, page numbers in Bengali and English digits, and the printed PDF has exactly as many pages as the preview (4, 4, 3 and 5 pages in four layouts). KaTeX was stubbed in that run. |
| Word export | Generated with `docx` 9.8, opened and rendered with LibreOffice: Bengali text, header grid, section bars, 4-column MCQ options, CQ marks on the right, list, table, signature lines and page-number fields all appear correctly |
| Cloud Functions syntax | `node --check` |

| **Not** verified | Why it matters |
| --- | --- |
| `npm install` and `vite build` with the real packages | A wrong third-party API call or version would only show up on first install |
| Firebase Auth, Firestore reads/writes, Firestore security rules, indexes | Rules were reviewed by hand, never run in the emulator. Test them with the emulator before real data goes in |
| Tiptap editor, dnd-kit drag and drop, real KaTeX output, Tailwind compilation | Not executable here |
| Cloudinary upload, SSLCommerz payment, XLSX/DOCX/PDF import with the real libraries | Written from documentation, never run |
| AI generation with the real Google Gemini API | The default mode (browser, user's own free key) was tested in Chromium against a fake Gemini server and with unit tests, never against Google itself. The Cloud Function mode was never run |
| Phones, tablets, other browsers | Only layout logic was checked, no device testing |

## 2. Feature matrix against the master prompt

Legend: **Done** = implemented, **Basic** = works but simple, **Missing** = not built.

| Spec section | Status | Notes |
| --- | --- | --- |
| 2 Stack (React, Vite, Tailwind, Firebase, Tiptap, KaTeX, dnd-kit, RHF + Zod, Zustand, Recharts) | Done | Zod/RHF are used on the auth and institution forms only |
| 4 Authentication | Done | Email, Google, reset, email verification gate, profile name/photo, sign out. No account-status screen |
| 5 Multi-institution | Done | Create or join by invitation, switch institution, isolated by `institutionId`. Branches are a plain list (no per-branch data) |
| 6 Dashboard | Done | Statistics, shortcuts, recent papers, activity (admins), 6-month chart |
| 7 Paper builder | Done | Blank / template / copy; sections (add, rename, duplicate, delete, reorder by drag); per-section type limits, answering rules ("answer any N", compulsory vs optional), numbering styles, option columns; questions (add, edit, duplicate, delete, reorder by drag, move to another section, from bank); automatic marks and validation. Drag between sections is not implemented, use "Move to..." |
| 8 Question editors | Done | MCQ (single/multiple, any option count, negative marking, fixed options), CQ and stimulus family (CQ, passage, case study, diagram, map), short, broad, mathematical, fill in the blanks, true/false, matching, practical, assertion-reason, ordering, numeric, programming, grammar, translation, and user-defined custom types |
| 9 Rich text | Done | Tiptap JSON: Bengali/English, bold/italic/underline, sup/sub, fonts, sizes, colors, alignment, lists, tables, images (URL or Cloudinary), LaTeX formulas |
| 10 Question bank | Done | Search, filters, sort, pagination, bulk archive/restore/delete/edit, duplicate detection, favorites, history with restore, add to paper. **Limit:** the latest 1000 questions are loaded and searched in the browser |
| 11 AI generator | Basic | Default: the browser calls Google Gemini with the user's own free key (no Cloud Functions, no billing; key kept in that browser only; usable models are read from the key and tried in order, so retired model names cannot break it). `VITE_AI_MODE=functions` keeps the original Cloud Function (rate limited, plan credits). Editable before saving. Pasted text or `.txt` only |
| 12 Import | Basic | CSV, XLSX, XLS (column mapping, type mapping, validation, duplicate detection, error report CSV, history); TXT, DOCX, PDF read as MCQ-format text. Formatting and images inside imported files are **not** preserved; rows that cannot be read are reported, not dropped silently. PDF reading loads pdf.js from a CDN and depends on the PDF |
| 13 Live preview | Done | Split screen, real pages with header, footer and page numbers |
| 14 Design studio, templates | Done | 9 ready-made templates, every design option, save/duplicate/edit/delete own templates |
| 15 Export | Basic | See section 5. PDF is produced through the browser print dialog, not a one-click download |
| 16 Multiple sets | Done | Sets A to F, shuffled questions inside sections, shuffled options (fixed options stay), equivalent bank swaps, per-set total check, Word/ZIP/print, save as paper to edit |
| 17 Answer keys | Done | Separate protected collection, rubric, explanations, PDF/Word export. Editing happens in the builder |
| 18 Roles | Basic | 8 institution roles with permissions enforced in rules and UI. Super admin exists only as a claim and script, **no admin console** |
| 19 Examination management | Basic | Lists for sessions and examinations, draft, review, approved, published workflow with notes and version history. No schedules or subject assignments |
| 20 Analytics | Basic | Client-side charts over loaded data |
| 21 Subscription | Basic | Plans, usage, limits (checked in the browser). SSLCommerz sandbox function written but untested. bKash and Nagad **not** implemented |
| 22 Notifications | Basic | In-app list, unread count, preferences. Created for review, approval and export events; no announcements screen; invitations are not emailed |
| 23 Security | Basic | Rules, role checks, isolated tenants, protected keys, server-side authorization and rate limit in functions, audit log for key actions. Rules untested; upload limits are client-side plus your Cloudinary preset |
| 24 UI | Done | Flat design, light/dark, English/Bengali, skeletons, empty states, toasts. No accessibility audit |
| 25 Performance | Basic | Route code splitting, Firestore indexes, only changed items are saved. No server-side question pagination |
| 26 Database structure | Done | See section 4 |
| 27 Testing | Basic | Unit tests only. No end-to-end or rules tests |
| 28 Deployment | Done | README |

## 3. Architecture

- **Single page app** (`react-router`), every route lazy loaded. State: Zustand (auth, UI, paper builder, bank cache). All Firebase access sits in `src/services`.
- **Paper model** (`src/preview/paperModel.js`): paper + questions become a renderer-independent structure (numbering, marks, "blocks"). The React preview, the print route and the DOCX writer all consume it, so they agree.
- **Paged renderer** (`PaperDocument.jsx`): measures each block off-screen, fills fixed-size pages, adds footer and page numbers. Printing uses the same component with `@page` set to the paper size, so print equals preview.
- **Question types** (`src/question-types`): one registry, one editor per family, and a pure function turning a question into printable blocks (and answer-key blocks).
- **Builder store**: tracks which questions changed; autosave writes only those (about 4 seconds after the last edit) and leaves the paper's `status` alone.

## 4. Firestore data model

Rich text is stored as Tiptap JSON inside **string fields** (`data`, `snapshot`) so documents stay small, avoid the nested-array and index-explosion limits, and are excluded from indexing (see `fieldOverrides`).

| Collection | Key fields |
| --- | --- |
| `users/{uid}` | profile, `prefs` |
| `institutions/{id}` | name, type, contact, logo, `plan`, `aiUsed` (server-only), `createdBy` |
| `memberships/{uid}_{institutionId}` | `uid`, `institutionId`, `role`, name, email |
| `invitations/{id}` | `email`, `role`, `status` (pending, accepted, declined) |
| `branches` `departments` `classes` `groups` `subjects` `sessions` `chapters` `topics` `examinations` | `institutionId`, `name` plus a few fields |
| `questionBank/{id}` | meta (type, marks, difficulty, class, subject, chapter, topic, tags), `searchText`, `fingerprint`, `data` (body JSON), `status`, `favoritedBy`, `version`; subcollection `history` |
| `answerKeys/{b_id or p_paper_item}` | `scope`, `paperId`, `questionId`, `data` (key JSON). Readable only by roles with key access |
| `questionPapers/{id}` | title, `status`, `info`, `design`, `sections` (ordered item ids), `totals`; subcollections `items` (one question each) and `versions` |
| `paperTemplates`, `questionTypes` | saved layouts, custom question type definitions |
| `notifications`, `activityLogs`, `exports`, `imports` | per-user inbox; audit and history logs |
| `subscriptions`, `payments` | written only by Cloud Functions |

Every document that belongs to an institution carries `institutionId`, `createdBy` and timestamps. Papers never put question arrays in one document.

## 5. Export notes

- **PDF**: real text and embedded fonts from the browser print engine (Chrome/Edge recommended); KaTeX formulas, images, tables, page numbers all print. A server-side one-click PDF (headless Chromium in a function) is not built.
- **Word**: same content and numbering as the preview. Differences: formulas become readable plain text (for example `(a+b)/(2)`), page border and watermark are not written, footer page numbers use Western digits, and the font must exist on the reader's computer (choose it in the design). Images are embedded when the host allows cross-origin download.
- **JSON**: paper with sections, questions and (if you may see them) keys. The question bank also exports to JSON and CSV (CSV has no answers).

## 6. Security model

- Access is decided by the membership document, in `firestore.rules` and again in Cloud Functions. The UI hides controls, but never is the only check.
- Roles and permissions live in `src/constants/roles.js` and are mirrored in the rules:

| Role | Can |
| --- | --- |
| Institution admin | everything in the institution, members, settings, billing |
| Teacher | create/edit own questions and papers, import, AI, keys of own work, templates, export |
| Department head | teacher + edit all, review, analytics, academics |
| Examination controller | review, publish, export, keys, analytics, academics |
| Paper reviewer | read, review, keys |
| Editor | create/edit all questions and papers, keys, templates, import |
| Viewer | read questions and approved/published papers |
| Print operator | read and export approved/published papers; no keys |

- Papers are editable only while `draft`; reviewers and publishers can only change status. Teachers read their own papers plus approved/published ones.
- Invitations require a verified email; institution plan and `aiUsed` cannot be changed by clients.
- Each rules write checks the caller's membership with one document lookup, and batches are kept small (a rules limit of 20 lookups per batch).
- **Known gaps:** plan limits for papers/questions/members/exports are enforced in the browser (AI credits are enforced on the server only in `functions` mode; the default free mode has no credit limit); the rules have not been tested in the emulator; there is no automatic malware scan of uploads.

## 7. Manual test checklist (spec section 27)

Run with two accounts and two institutions, ideally on the Firebase emulator first.

| Area | Steps | Expect |
| --- | --- | --- |
| Registration, login | Register, open the verification email, sign in, try Google | Unverified accounts are sent to the verify page |
| Institution creation, isolation | Create institution A and B with different users, add questions to A | B cannot read or open anything from A, even by pasting a paper URL |
| Roles, invitations | Invite a teacher, accept after verifying the email, change role to viewer | Viewer cannot see create buttons, rules reject writes |
| MCQ / CQ / all types | Create one question of each type, save, reopen | Content and answers preserved |
| Mixed paper | One paper with MCQ + CQ + short + broad sections | Marks per section and total correct; Checks tab shows no errors |
| Answering rule | Section "answer any 4 of 6" with one compulsory | Section marks follow the rule |
| Bank | Search, filter, favorite, archive, duplicate, history restore | As described |
| Import | CSV with one bad row, an MCQ text file | Valid rows imported, bad row listed in the error report |
| AI | Paste a free Gemini key (README 3c), generate 3 MCQ | Drafts appear, edit, save to bank |
| Templates, studio | Apply each template, save a custom one | Preview changes immediately |
| Bengali PDF | Print view, Save as PDF | Pages match preview, conjuncts and digits correct |
| Word | Export paper and key | Opens in Word, Bengali readable |
| Sets | Generate A to D | Equal marks per set; each key matches shuffled options |
| Workflow | Submit, approve, publish with two accounts | Status rules enforced, editing locked after submit |
| Subscription | Use the free plan beyond its limits | Create actions are refused with a message |
| Document security | As viewer open a draft paper id or an answer key | Denied by rules |
| Mobile | Use a phone | Edit/Preview toggle works, tables scroll |

## 8. Known limitations and next phase

Highest value next steps: run `npm install` and fix any API mismatch; test and tighten rules in the emulator; server-side PDF generation; super admin console; email delivery of invitations (Firebase "Trigger Email" extension); server-enforced plan limits (Cloud Function triggers); question-bank pagination and server-side search; cross-section drag and drop; bKash and Nagad adapters; end-to-end tests.

The `xlsx` package on npm (0.18.5) is an old build with published vulnerabilities. Only open spreadsheets you trust, or switch to the SheetJS-hosted tarball.
