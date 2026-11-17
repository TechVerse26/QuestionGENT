# EXAM MASTER

Question paper builder, question bank and examination management for schools, colleges, madrasas, coaching centers and teachers.
React + Vite + Tailwind on the front end, Firebase (Auth, Firestore, Cloud Functions) on the back end, Vercel for hosting.

> **Status: Phase 1.** The core (paper builder, question editors, question bank, live paged preview, print/PDF, Word export, templates,
> answer keys, sets, import, roles, security rules) is written and partly verified. Several modules from the master prompt are basic or
> not built yet. Read the honest feature matrix in [`PROJECT_DOCUMENTATION.md`](PROJECT_DOCUMENTATION.md) before relying on anything.

## দ্রুত শুরু (Termux / যেকোনো কম্পিউটার)

```bash
pkg install nodejs-lts git unzip        # শুধু Termux-এ; অন্য সিস্টেমে Node 18+ ইনস্টল করুন
unzip EXAM-MASTER-COMPLETE-REACT-PROJECT.zip && cd EXAM-MASTER
cp .env.example .env                    # তারপর .env-এ Firebase কনফিগ বসান
npm install
npm run dev                             # http://localhost:5173
```

## Requirements

- Node.js 18 or newer (20 recommended; Cloud Functions use Node 20)
- A Firebase project (free Spark plan is enough for the app; **Cloud Functions need the Blaze plan**)
- Optional: Cloudinary account (image upload), a free Google Gemini key for each user (AI generator, section 3c), SSLCommerz sandbox account (payments)

## 1. Firebase setup

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication, Sign-in method:** enable *Email/Password* and *Google*. Under *Settings, Authorized domains* add your Vercel domain later.
3. **Firestore Database:** create a database in production mode (pick a region near your users).
4. **Project settings, Your apps:** add a *Web app* and copy its config into `.env` (`VITE_FIREBASE_*`).
5. Deploy security rules and indexes:

   ```bash
   npm install -g firebase-tools
   firebase login
   cp .firebaserc.example .firebaserc      # put your project id inside
   firebase deploy --only firestore:rules,firestore:indexes
   ```

   No CLI (for example on a phone)? Paste `firestore.rules` into *Firestore, Rules* in the console and create the indexes listed in
   `firestore.indexes.json` when the console links them from an error message. Indexes take a few minutes to build.
6. Start the app, register, verify your email, then create your institution on the onboarding page.

### Cloud Functions (optional: payments, or the server-side AI generator)

The AI generator does **not** need these: by default it runs in the browser with each user's own free Gemini key (section 3c).

```bash
cd functions && npm install && cd ..
firebase functions:secrets:set GEMINI_API_KEY          # AI generator, only with VITE_AI_MODE=functions (section 3c)
firebase functions:secrets:set SSLC_STORE_ID           # payments (sandbox first)
firebase functions:secrets:set SSLC_STORE_PASS
firebase deploy --only functions                        # prompts for APP_URL and CALLBACK_BASE_URL
```

- `GEMINI_MODEL` defaults to `gemini-2.5-flash`, which Google no longer gives to new projects. Set `GEMINI_MODEL` in `functions/.env` to a current model name from <https://ai.google.dev/gemini-api/docs/models> (for example `gemini-3.5-flash-lite`).
- Set `VITE_FUNCTIONS_REGION` in `.env` if you deploy functions outside `us-central1`.
- The manual workflow and the AI generator work without any function. The *Choose* plan buttons show a clear message when functions are missing.
- Platform super admin: `GOOGLE_APPLICATION_CREDENTIALS=key.json node functions/scripts/set-super-admin.js <uid>` (there is no super admin screen yet).

## 2. Image hosting (optional)

Images can always be inserted by URL. For uploads create a Cloudinary **unsigned** upload preset (restrict it to png/jpg/webp/gif and a
small maximum size), then set `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET`. Only the returned URL is stored in Firestore.

## 3. Deploy the front end to Vercel

1. Push the project to GitHub and import it in Vercel (framework: Vite, build `npm run build`, output `dist`), or run `npx vercel --prod`.
2. Add every `VITE_*` variable from `.env` in *Project settings, Environment variables*.
3. `vercel.json` already rewrites all routes to `index.html` (single page app).
4. Add the Vercel domain to Firebase *Authentication, Authorized domains*.

## 3b. Deploy the front end to GitHub Pages (alternative to Vercel)

GitHub Pages hosts static files only, which is all the front end needs (Firebase Auth and Firestore are called straight from the browser).
Cloud Functions (payments) cannot run on GitHub and still need the Blaze plan. The AI generator does not need them (section 3c).

1. The Firebase web config lives in `.env.production` (public identifiers, not secrets). Edit it if you switch Firebase projects.
2. Create a **public** GitHub repository and push this folder to its `main` branch.
3. Repository *Settings, Pages, Build and deployment, Source*: **GitHub Actions**.
4. `.github/workflows/deploy.yml` builds on every push to `main` and publishes to `https://USER.github.io/REPO/`. It sets `BASE_PATH`
   (Vite `base`) by itself, so the repository can have any name, and copies `index.html` to `404.html` so deep links and refreshes work.
5. Firebase console, *Authentication, Settings, Authorized domains*: add `USER.github.io`.

The app is also a PWA. On a phone or desktop browser the **Install app** button (or the browser's *Add to Home Screen* / *Install*) puts it on the home
screen, where it opens in its own window straight into the dashboard. The PWA files are `public/manifest.webmanifest`, `public/icons/` and `public/sw.js`.
The service worker only caches the app's own build files and fonts; Firebase, Google APIs and uploads always go to the network. The workflow stamps a new
build id into `sw.js` on every deploy so installed apps pick up the new version by themselves. It is registered in production builds only (not `npm run dev`).

## 3c. AI question generator for free (no card, no Cloud Functions)

By default (`VITE_AI_MODE` unset or `direct`) the AI page calls Google Gemini straight from the browser with the user's **own free key**.
Nothing runs on a server, so the Firebase Spark plan is enough and no payment card is needed.

1. Open the *AI* page. The *Free AI key* box opens by itself.
2. Open <https://aistudio.google.com/apikey>, sign in with a Google account, create an API key and copy it.
3. Paste it into the box and tap *Save key*. The app checks the key and shows which model it will use.

Good to know:

- The key is saved in that browser only, per signed-in user. It is never sent to Firestore and never goes into the repository (a Gemini key committed to a public repository gets switched off by Google). Each teacher creates their own key; sharing one key shares its free quota.
- Google sets the free limits per project and per model and changes them from time to time. When one model is used up the app tries the next Flash or Flash-Lite model the key can use, and if all are used up it says so (the daily limit resets around 1 to 2 PM Bangladesh time). Asking for 10 to 20 questions at once uses fewer requests than many small asks.
- Google may use free-tier prompts to improve its products, so do not paste private student data.
- Model names are read from the key (`GET /v1beta/models`), so a retired name such as `gemini-2.5-flash` cannot break the page. The *Model* menu in the key box pins one model; leave it on *Automatic* normally.
- Plan credits (`aiCredits`) are not applied in this mode. `VITE_AI_MODE=functions` brings back the original Cloud Function (needs the Blaze plan, the `GEMINI_API_KEY` secret and a current `GEMINI_MODEL`).
- Plan limits for papers, questions and members are checked in the browser against `institutions/<id>.plan`. New institutions start on `free`. With no payment flow you can lift them yourself in the Firebase console: *Firestore Database*, `institutions`, your institution, set the field `plan` to `enterprise` (unlimited).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (listens on all interfaces, port 5173) |
| `npm run build` / `npm run preview` | Production build / serve the build |
| `npm test` | Unit tests for marks, numbering, parsers, sets, pagination, DOCX output (Node test runner) |
| `npm run check` | Bundles `src/` with esbuild to catch syntax errors and bad local imports quickly |
| `npm run deploy:firestore` | Deploy rules and indexes |
| `npm run deploy:functions` | Deploy Cloud Functions |
| `npm run emulators` | Local Firebase emulators (set `VITE_USE_EMULATORS=true`) |

## Using PDF export

*Export, Print / save as PDF* opens a print view with the same pages as the live preview. In the browser print dialog choose
**Save as PDF**, margins **None**, headers and footers **off**. The browser's print engine writes real text and embeds the Bengali fonts,
so the PDF has the same page breaks as the preview. Use Chrome or Edge for the most reliable result. Fonts load from Google Fonts, so the
first print needs internet access.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Page says *Firebase is not configured* | Fill `.env` and restart `npm run dev` (Vite reads `.env` only at start). |
| *Missing or insufficient permissions* | Deploy `firestore.rules`; check you have an institution membership; invitations need a **verified** email. |
| *The query requires an index* | Deploy `firestore.indexes.json` or open the link in the error message. |
| Print window does not open | Allow pop-ups for the site. |
| Wrong Bengali glyphs in Word | Pick a font installed on that computer in *Design, Font (Word file)* (Nirmala UI on Windows). |
| Images missing in the Word file | The image host must allow cross-origin requests (Cloudinary does). |
| Out-of-memory during `npm run build` on a phone | `NODE_OPTIONS=--max-old-space-size=1536 npm run build` |
| `firebase deploy --only functions` fails | Upgrade to the Blaze plan; use Node 20; run `npm install` inside `functions/`. |

## Backup and recovery

Enable Firestore scheduled backups or point-in-time recovery in the Google Cloud console, or export on demand:
`gcloud firestore export gs://YOUR_BUCKET/backups/$(date +%F)`. Papers keep version snapshots (without answer keys).

## Folder map

```
src/
  components/      common UI, rich text editor (Tiptap + KaTeX), design controls
  editors/         one editor per question family (MCQ, CQ, short, broad, math, fill, true/false, matching, practical, custom, extras)
  question-types/  type registry and the printable "blocks" each type produces
  preview/         paged paper renderer used by preview and print, shared paper model, pagination
  export/          print, DOCX, JSON and shared export runner
  import/          CSV / XLSX / TXT / DOCX / PDF readers
  pages/           route screens (dashboard, builder, bank, library, templates, studio, keys, import/export, team, ...)
  services/        all Firestore, Functions and upload access
  store/ hooks/    Zustand stores and hooks
  utils/ constants/ i18n/   pure logic (unit tested), role/plan/template data, Bengali dictionary
functions/         Cloud Functions (AI generation, SSLCommerz payment verification, authorization helpers)
firestore.rules, firestore.indexes.json, firebase.json, vercel.json
tests/             Node unit tests
```
