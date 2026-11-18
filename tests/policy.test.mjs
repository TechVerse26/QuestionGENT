// Repository policies from the master prompt, enforced as tests so they cannot regress silently.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'coverage', 'out']);
const BINARY = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|otf|zip|gz|enc|pdf)$/i;

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc); else if (!BINARY.test(name)) acc.push(p);
  }
  return acc;
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const files = walk(ROOT).filter((p) => statSync(p).size < 2_000_000);
const code = files.filter((p) => /\.(js|jsx|mjs|cjs)$/.test(p) && !rel(p).startsWith('tests/'));
const text = (p) => readFileSync(p, 'utf8');

test('POLICY: Firebase Storage is never used (no SDK import, no upload helpers, no storage bucket)', () => {
  const bad = /firebase\/storage|firebase-admin\/storage|@firebase\/storage|\bgetStorage\s*\(|\buploadBytes(Resumable)?\s*\(|\buploadString\s*\(|\.storage\(\)|\bfirebasestorage\.(app|googleapis\.com)\b/;
  const hits = code.filter((p) => bad.test(text(p))).map(rel);
  assert.deepEqual(hits, [], `Firebase Storage reference found in: ${hits.join(', ')}`);
  for (const pkg of ['package.json', 'functions/package.json']) {
    const deps = JSON.stringify(Object.keys({ ...JSON.parse(text(path.join(ROOT, pkg))).dependencies, ...JSON.parse(text(path.join(ROOT, pkg))).devDependencies }));
    assert.ok(!/storage/.test(deps), `${pkg} depends on a storage package: ${deps}`);
  }
});

test('POLICY: layering - shared code is isomorphic, server code never reaches the browser bundle', () => {
  const shared = code.filter((p) => rel(p).startsWith('src/shared/'));
  assert.ok(shared.length >= 8, 'shared modules exist');
  for (const p of shared) {
    const imports = [...text(p).matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const spec of imports) assert.ok(spec.startsWith('.') || spec === 'zod', `${rel(p)} imports "${spec}" (shared code may only import relative modules and zod: no node:, firebase, react or next)`);
  }
  const clientCode = code.filter((p) => rel(p).startsWith('src/') && !rel(p).startsWith('src/server/') && !rel(p).startsWith('src/shared/'));
  for (const p of clientCode) assert.ok(!/from\s+['"][^'"]*\/server\//.test(text(p)), `${rel(p)} imports server-only code`);
  for (const p of code.filter((p) => rel(p).startsWith('src/server/'))) assert.ok(!/from\s+['"]react|from\s+['"]firebase\/(app|auth|firestore)['"]/.test(text(p)), `${rel(p)}: server modules must not depend on browser SDKs`);
});

test('POLICY: no secrets are committed (private keys, cloud/API keys, service accounts)', () => {
  const patterns = [
    ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
    ['service account JSON', /"private_key"\s*:\s*"/],
    ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
    ['AWS access key id', /\bAKIA[0-9A-Z]{16}\b/],
    ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
    ['Slack token', /\bxox[baprs]-[0-9A-Za-z-]{10,}/],
    ['OpenAI-style key', /\bsk-[A-Za-z0-9]{20,}/],
    // env-file style assignment at the start of a line (code such as `const X = defineSecret('X')` is not a value)
    ['assigned secret', /^[ \t]*(?:export[ \t]+)?(GEMINI_API_KEY|SSLC_STORE_PASS(?:WORD)?|CLOUDINARY_API_SECRET|S3_SECRET_ACCESS_KEY|BACKUP_ENCRYPTION_KEY|SESSION_SECRET)[ \t]*=[ \t]*["']?[^\s#"']{8,}/m],
  ];
  // The Firebase WEB api key is a public identifier by design; it is allowed only in the committed production env file.
  const allowed = { 'Google API key': new Set(['.env.production']) };
  const problems = [];
  for (const p of files) {
    const r = rel(p);
    if (r === 'tests/policy.test.mjs') continue;
    const t = text(p);
    for (const [name, re] of patterns) if (re.test(t) && !(allowed[name]?.has(r))) problems.push(`${r}: ${name}`);
  }
  assert.deepEqual(problems, []);
});

test('POLICY: .gitignore keeps env files, keys, service accounts, backups and build output out of git', () => {
  const gi = text(path.join(ROOT, '.gitignore')).split('\n').map((l) => l.trim());
  for (const needed of ['node_modules', '.env', '.env.local', '.env*.local', '*.pem', 'serviceAccount*.json', '*-firebase-adminsdk-*.json', 'backups/', '.next']) assert.ok(gi.includes(needed), `.gitignore is missing ${needed}`);
  assert.ok(!gi.includes('.env.production') && !gi.includes('.env.example'), 'public env files stay tracked');
});

test('POLICY: .env.example never carries a value for a secret setting', () => {
  const lines = text(path.join(ROOT, '.env.example')).split('\n').filter((l) => /^[A-Z0-9_]+=/.test(l));
  assert.ok(lines.length >= 5);
  for (const l of lines) {
    const [k, v] = [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)];
    if (/(SECRET|PASS|PRIVATE|TOKEN|API_KEY)/.test(k) && !k.startsWith('VITE_FIREBASE_')) assert.equal(v, '', `${k} must be empty in .env.example`);
    assert.ok(!/^VITE_.*(SECRET|PRIVATE|PASS)/.test(k), `${k}: a browser-exposed variable must not be a secret`);
  }
});
