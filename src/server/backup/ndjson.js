// Export / verify / restore pipeline for Firestore backups (gzip-NDJSON, optional AES-256-GCM, manifest with SHA-256).
// Storage-agnostic: `source` reads documents, `store` keeps files, `sink` receives restored documents.
//   source.read(unit, { since }) -> AsyncIterable<{ path, data }>
//   store: put/get/exists/readJson/writeJson            sink: { projectId, isProduction?, exists(path), set(path, data, { merge }) }
import { createGzip, createGunzip } from 'node:zlib';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { encodeValue, decodeValue, PLAIN_FACTORIES } from './codec.js';
import { encryptStream, decryptStream } from './crypto.js';
import { unitFileName } from './targets.js';

export class RestoreGuardError extends Error { constructor(code, message) { super(message); this.code = code; } }

async function* viaTransform(make, chunks) {
  const t = make();
  const feeder = (async () => {
    try {
      for await (const c of chunks) if (!t.write(c)) await once(t, 'drain');
      t.end();
    } catch (e) { t.destroy(e); }
  })();
  for await (const out of t) yield out;
  await feeder;
}
const gzipStream = (chunks) => viaTransform(() => createGzip({ level: 6 }), chunks);
const gunzipStream = (chunks) => viaTransform(() => createGunzip(), chunks);

async function* ndjsonRecords(chunks) {
  const dec = new TextDecoder('utf-8', { fatal: true });
  let rest = '';
  let line = 0;
  const parse = (s) => {
    line += 1;
    let rec;
    try { rec = JSON.parse(s); } catch { throw new Error(`Invalid JSON on line ${line}`); }
    if (typeof rec?.p !== 'string' || rec.d === null || typeof rec.d !== 'object') throw new Error(`Malformed record on line ${line}`);
    return rec;
  };
  for await (const c of chunks) {
    rest += dec.decode(c, { stream: true });
    let i;
    while ((i = rest.indexOf('\n')) >= 0) { const s = rest.slice(0, i); rest = rest.slice(i + 1); if (s) yield parse(s); }
  }
  rest += dec.decode();
  if (rest.trim()) yield parse(rest);
}

const readFile = (store, name, masterKey) => {
  let s = store.get(name);
  if (masterKey) s = decryptStream(s, masterKey);
  return ndjsonRecords(gunzipStream(s));
};

export async function exportBackup({ source, store, units, masterKey = null, project = null, label = '', since = null, now = () => Date.now() }) {
  const files = [];
  for (const unit of units) {
    const name = unitFileName(unit, !!masterKey);
    let docs = 0;
    async function* lines() {
      for await (const doc of source.read(unit, { since })) { docs += 1; yield Buffer.from(`${JSON.stringify({ p: doc.path, d: encodeValue(doc.data) })}\n`); }
    }
    let out = gzipStream(lines());
    if (masterKey) out = encryptStream(out, masterKey);
    const { bytes, sha256 } = await store.put(name, out);
    files.push({ name, unit: unit.id, type: unit.type, docs, bytes, sha256 });
  }
  const manifest = {
    format: 'em-backup', version: 1, createdAt: new Date(now()).toISOString(), label, project,
    kind: since ? 'incremental' : 'full', since: since ? new Date(since).toISOString() : null, encrypted: !!masterKey,
    files, totals: { docs: files.reduce((a, f) => a + f.docs, 0), bytes: files.reduce((a, f) => a + f.bytes, 0) },
  };
  await store.writeJson('manifest.json', manifest);
  return manifest;
}

export async function verifyBackup({ store, masterKey = null }) {
  const problems = [];
  let manifest;
  try { manifest = await store.readJson('manifest.json'); } catch { return { ok: false, problems: [{ code: 'MANIFEST_UNREADABLE' }], manifest: null }; }
  if (manifest?.format !== 'em-backup' || !Array.isArray(manifest.files)) return { ok: false, problems: [{ code: 'MANIFEST_INVALID' }], manifest };
  if (manifest.encrypted && !masterKey) return { ok: false, problems: [{ code: 'KEY_REQUIRED' }], manifest };
  let docs = 0;
  for (const f of manifest.files) {
    if (!(await store.exists(f.name))) { problems.push({ file: f.name, code: 'MISSING' }); continue; }
    const hash = createHash('sha256'); let bytes = 0;
    for await (const c of store.get(f.name)) { hash.update(c); bytes += c.length; }
    if (bytes !== f.bytes) problems.push({ file: f.name, code: 'SIZE_MISMATCH' });
    if (hash.digest('hex') !== f.sha256) { problems.push({ file: f.name, code: 'CHECKSUM_MISMATCH' }); continue; }
    let n = 0;
    try { for await (const rec of readFile(store, f.name, manifest.encrypted ? masterKey : null)) { void rec; n += 1; } } catch (e) { problems.push({ file: f.name, code: 'UNREADABLE', detail: e.message }); continue; }
    docs += n;
    if (n !== f.docs) problems.push({ file: f.name, code: 'COUNT_MISMATCH', expected: f.docs, actual: n });
  }
  if (problems.length === 0 && docs !== manifest.totals?.docs) problems.push({ code: 'TOTAL_MISMATCH', expected: manifest.totals?.docs, actual: docs });
  return { ok: problems.length === 0, problems, manifest };
}

const MODES = ['skip-existing', 'overwrite', 'merge'];

export async function restoreBackup({
  store, sink, masterKey = null, mode = 'skip-existing', units = null, dryRun = false, allowCrossProject = false, confirm = null, verifyFirst = true, factories = PLAIN_FACTORIES,
}) {
  if (!MODES.includes(mode)) throw new RestoreGuardError('BAD_MODE', `mode must be one of ${MODES.join(', ')}`);
  const check = verifyFirst ? await verifyBackup({ store, masterKey }) : { ok: true, manifest: await store.readJson('manifest.json') };
  if (!check.ok) throw new RestoreGuardError('BACKUP_INVALID', `Backup failed verification: ${JSON.stringify(check.problems)}`);
  const { manifest } = check;
  if (manifest.project && sink.projectId && manifest.project !== sink.projectId && !allowCrossProject) throw new RestoreGuardError('CROSS_PROJECT', `Backup is from "${manifest.project}" but the target is "${sink.projectId}"`);
  if (!dryRun && sink.isProduction && confirm !== `RESTORE ${sink.projectId}`) throw new RestoreGuardError('CONFIRMATION_REQUIRED', `Pass confirm: "RESTORE ${sink.projectId}" to write to a production project`);
  const report = { mode, dryRun, units: {}, totals: { read: 0, written: 0, skipped: 0, errors: 0 }, errors: [] };
  for (const f of manifest.files) {
    if (units && !units.includes(f.unit)) continue;
    const r = (report.units[f.unit] = { read: 0, written: 0, skipped: 0, errors: 0 });
    for await (const rec of readFile(store, f.name, manifest.encrypted ? masterKey : null)) {
      r.read += 1;
      try {
        const segs = rec.p.split('/');
        if (segs.length < 2 || segs.length % 2 !== 0 || segs.some((s) => !s)) throw new Error(`Bad document path: ${rec.p}`);
        if (mode === 'skip-existing' && (await sink.exists(rec.p))) { r.skipped += 1; continue; }
        if (!dryRun) await sink.set(rec.p, decodeValue(rec.d, factories), { merge: mode === 'merge' });
        r.written += 1;
      } catch (e) {
        r.errors += 1;
        if (report.errors.length < 100) report.errors.push({ unit: f.unit, path: rec.p, message: e.message });
      }
    }
    for (const k of ['read', 'written', 'skipped', 'errors']) report.totals[k] += r[k];
  }
  return report;
}
