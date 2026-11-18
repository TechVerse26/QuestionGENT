import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { encodeValue, decodeValue, TimestampLike, GeoPointLike, RefLike, VectorLike } from '../../src/server/backup/codec.js';
import { encryptStream, decryptStream, deriveMasterKey, BackupCryptoError } from '../../src/server/backup/crypto.js';
import { DirStore } from '../../src/server/backup/stores.js';
import { exportBackup, verifyBackup, restoreBackup, RestoreGuardError } from '../../src/server/backup/ndjson.js';
import { BACKUP_UNITS, TOP_LEVEL_COLLECTIONS, SUBCOLLECTION_GROUPS, unitFileName } from '../../src/server/backup/targets.js';
import { FakeSource, FakeSink, makeDataset } from './helpers/fakeFirestore.mjs';

const SECRET = 'correct-horse-battery-staple-0123456789';
const KEY = deriveMasterKey(SECRET);
const collect = async (it) => { const out = []; for await (const c of it) out.push(Buffer.from(c)); return Buffer.concat(out); };
async function* from(...bufs) { for (const b of bufs) yield b; }
const tmp = async (t) => { const d = await mkdtemp(path.join(tmpdir(), 'embk-')); t.after(() => rm(d, { recursive: true, force: true })); return d; };

// ------------------------------------------------------------------ codec
test('codec: every Firestore-style value survives a JSON round trip', () => {
  const original = {
    s: 'বাংলা ✓ 😀', n: 42, f: -0.125, big: Number.MAX_SAFE_INTEGER, b: true, nul: null,
    nan: NaN, inf: Infinity, ninf: -Infinity, negZero: -0,
    ts: new TimestampLike(1700000000, 123456789), date: new Date('2026-11-17T01:02:03.456Z'),
    geo: new GeoPointLike(23.81, 90.41), ref: new RefLike('institutions/i1/branches/b1'), bytes: Buffer.from([0, 1, 254, 255]), vec: new VectorLike([1, 2.5]),
    arr: [1, 'two', [3, { four: 4 }], null], map: { nested: { deep: { deeper: 1 } } }, empty: {}, emptyArr: [],
    __t: 'collides with the marker key', marker: { __t: 'ts', s: 5, n: 5 },
  };
  const wire = JSON.parse(JSON.stringify(encodeValue(original)));
  const back = decodeValue(wire);
  assert.ok(Number.isNaN(back.nan)); assert.equal(back.inf, Infinity); assert.equal(back.ninf, -Infinity); assert.ok(Object.is(back.negZero, -0));
  assert.deepEqual([back.ts.seconds, back.ts.nanoseconds], [1700000000, 123456789]);
  assert.equal(back.date.toMillis(), Date.parse('2026-11-17T01:02:03.456Z'));
  assert.deepEqual([back.geo.latitude, back.geo.longitude], [23.81, 90.41]);
  assert.equal(back.ref.path, 'institutions/i1/branches/b1');
  assert.deepEqual([...back.bytes], [0, 1, 254, 255]);
  assert.deepEqual(back.vec.toArray(), [1, 2.5]);
  assert.deepEqual(back.arr, [1, 'two', [3, { four: 4 }], null]);
  assert.deepEqual(back.map, original.map);
  assert.equal(back.__t, 'collides with the marker key', 'a user field named __t is escaped, not misread');
  assert.deepEqual(back.marker, { __t: 'ts', s: 5, n: 5 }, 'a user map that looks like a marker stays a map');
  assert.equal(back.s, original.s);
});

test('codec: undefined is dropped in maps and nulled in arrays; unknown types fail loudly; factories build SDK classes', () => {
  assert.deepEqual(decodeValue(encodeValue({ a: undefined, b: 1, c: [undefined, 2] })), { b: 1, c: [null, 2] });
  assert.throws(() => encodeValue({ x: () => 1 }), /Unsupported value type/);
  assert.throws(() => encodeValue({ x: Symbol('s') }), /Unsupported value type/);
  assert.throws(() => encodeValue({ x: new Map() }), /Unsupported object type/);
  assert.throws(() => decodeValue({ __t: 'mystery' }), /Unknown value marker/);
  const made = [];
  const f = { timestamp: (s, n) => { made.push(['ts', s, n]); return 'TS'; }, geopoint: () => 'GEO', reference: (p) => `REF:${p}`, bytes: () => 'BYTES', vector: () => 'VEC' };
  assert.deepEqual(decodeValue(encodeValue({ a: new TimestampLike(1, 2), b: new RefLike('x/y') }), f), { a: 'TS', b: 'REF:x/y' });
  assert.deepEqual(made, [['ts', 1, 2]]);
  assert.equal(encodeValue(new Date(-1500)).n, 500000000, 'dates before 1970 keep a positive nanosecond part');
});

// ------------------------------------------------------------------ encryption
test('encryption: round trip at every block boundary, one-byte chunks and one huge chunk', async () => {
  for (const size of [0, 1, 15, 16, 17, 63, 64, 65, 127, 128, 129, 1000]) {
    const plain = Buffer.from(Array.from({ length: size }, (_, i) => (i * 7 + 3) % 256));
    const enc = await collect(encryptStream(from(plain), KEY, { blockSize: 64 }));
    assert.deepEqual(await collect(decryptStream(from(enc), KEY)), plain, `size ${size}`);
  }
  const plain = Buffer.from('বাংলা ডেটা '.repeat(200));
  const enc = await collect(encryptStream(from(plain), KEY, { blockSize: 100 }));
  const oneByte = (async function* () { for (const b of enc) yield Buffer.from([b]); })();
  assert.deepEqual(await collect(decryptStream(oneByte, KEY)), plain, 'decrypts from one-byte reads');
  const big = Buffer.alloc(10_000, 7);
  assert.deepEqual(await collect(decryptStream(from(await collect(encryptStream(from(big), KEY, { blockSize: 64 }))), KEY)), big);
  assert.ok(!(await collect(encryptStream(from(plain), KEY))).includes(Buffer.from('বাংলা')), 'ciphertext does not contain the plaintext');
});

test('encryption: tampering, truncation, reordering, appending and a wrong key are all detected', async () => {
  const plain = Buffer.alloc(300, 9); // blockSize 64 -> 5 chunks
  const enc = await collect(encryptStream(from(plain), KEY, { blockSize: 64 }));
  const headerLen = 21;
  const chunks = []; // split into [header, chunk...]
  let o = headerLen;
  while (o < enc.length) { const len = enc.readUInt32BE(o); chunks.push(enc.subarray(o, o + 4 + len + 16)); o += 4 + len + 16; }
  assert.equal(o, enc.length);
  assert.equal(chunks.length, 5);
  const header = enc.subarray(0, headerLen);
  const fails = async (buf, why) => assert.rejects(() => collect(decryptStream(from(buf), KEY)), BackupCryptoError, why);

  const flip = (pos) => { const c = Buffer.from(enc); c[pos] ^= 1; return c; };
  await fails(flip(3), 'magic');
  await fails(flip(10), 'salt');
  await fails(flip(headerLen + 6), 'ciphertext of chunk 0');
  await fails(flip(headerLen + 4 + 64 + 2), 'tag of chunk 0');
  await fails(flip(enc.length - 1), 'tag of the last chunk');
  await fails(Buffer.concat([header, ...chunks.slice(0, -1)]), 'last chunk removed at a boundary');
  await fails(enc.subarray(0, enc.length - 1), 'one byte short');
  await fails(header, 'header only');
  await fails(Buffer.alloc(0), 'empty file');
  await fails(Buffer.concat([enc, chunks[0]]), 'chunk appended');
  await fails(Buffer.concat([enc, Buffer.from([0])]), 'garbage appended');
  await fails(Buffer.concat([header, chunks[1], chunks[0], chunks[2], chunks[3], chunks[4]]), 'chunks reordered');
  await fails(Buffer.concat([header, chunks[0], chunks[0], chunks[1], chunks[2], chunks[3], chunks[4]]), 'chunk duplicated');
  await assert.rejects(() => collect(decryptStream(from(enc), deriveMasterKey('another-secret-another-secret-123456'))), BackupCryptoError, 'wrong key');
  await assert.rejects(() => collect(decryptStream(from(Buffer.from('this is not a backup file at all')), KEY)), /Not an encrypted/);
  assert.throws(() => deriveMasterKey('too short'), BackupCryptoError);
  // untouched file still decrypts
  assert.deepEqual(await collect(decryptStream(from(enc), KEY)), plain);
});

// ------------------------------------------------------------------ export / verify / restore
test('DirStore refuses unsafe names and leaves no partial file when the stream fails', async (t) => {
  const dir = await tmp(t);
  const store = new DirStore(dir);
  for (const bad of ['../x', 'a/b', '..', '.hidden', 'x y', '', 'a\\b']) assert.throws(() => store.get(bad), /Unsafe/, bad);
  await assert.rejects(() => store.put('good.bin', (async function* () { yield Buffer.from('a'); throw new Error('boom'); })()), /boom/);
  assert.deepEqual(await readdir(dir), [], 'no .tmp leftovers and no truncated final file');
  const r = await store.put('ok.bin', from(Buffer.from('hello')));
  assert.equal(r.bytes, 5);
  assert.equal(r.sha256, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
});

test('backup drill (encrypted): export -> verify -> restore into an empty database -> identical documents', async (t) => {
  const dir = await tmp(t);
  const store = new DirStore(dir);
  const data = makeDataset();
  const source = new FakeSource(data);
  const manifest = await exportBackup({ source, store, units: BACKUP_UNITS, masterKey: KEY, project: 'tvexam-test', label: 'drill', now: () => Date.UTC(2026, 10, 17) });

  assert.equal(manifest.encrypted, true);
  assert.equal(manifest.kind, 'full');
  assert.equal(manifest.createdAt, '2026-11-17T00:00:00.000Z');
  assert.equal(manifest.files.length, BACKUP_UNITS.length);
  const expectedDocs = Object.values(data).reduce((a, l) => a + l.length, 0);
  assert.equal(manifest.totals.docs, expectedDocs);
  const qbFile = manifest.files.find((f) => f.unit === 'questionBank');
  assert.equal(qbFile.docs, data.questionBank.length);
  assert.equal(qbFile.name, 'questionBank.ndjson.gz.enc');
  assert.equal(manifest.files.find((f) => f.unit === 'history').name, 'g__history.ndjson.gz.enc');
  assert.ok(qbFile.bytes > 1_048_576, 'large enough to span several encrypted blocks');
  const raw = await readFile(path.join(dir, qbFile.name));
  assert.ok(!raw.includes(Buffer.from('questionBank')) && !raw.includes(Buffer.from('algebra')), 'nothing readable in an encrypted backup');

  const verified = await verifyBackup({ store, masterKey: KEY });
  assert.deepEqual(verified.problems, []);
  assert.equal(verified.ok, true);

  const sink = new FakeSink({ projectId: 'tvexam-test' });
  const report = await restoreBackup({ store, sink, masterKey: KEY });
  assert.equal(report.totals.read, expectedDocs);
  assert.equal(report.totals.written, expectedDocs);
  assert.equal(report.totals.errors, 0);
  assert.equal(sink.docs.size, expectedDocs);
  for (const list of Object.values(data)) for (const d of list) {
    assert.ok(sink.docs.has(d.path), `missing ${d.path}`);
    assert.deepEqual(encodeValue(sink.docs.get(d.path)), encodeValue(d.data), `content differs for ${d.path}`);
  }
  const weird = sink.docs.get('questionBank/weird');
  assert.ok(Number.isNaN(weird.nan) && Object.is(weird.negZero, -0) && weird.inf === Infinity);
  assert.equal(weird.__t, 'user-field-named-__t');
  assert.deepEqual(sink.docs.get('questionBank/blob').blob.length, 1_500_000);
});

test('backup (plain, no encryption) also verifies and restores; incremental passes `since` to the source', async (t) => {
  const dir = await tmp(t);
  const store = new DirStore(dir);
  const source = new FakeSource(makeDataset({ questions: 10, withBlob: false }));
  const units = BACKUP_UNITS.filter((u) => ['users', 'questionBank'].includes(u.id));
  const m = await exportBackup({ source, store, units, project: 'p' });
  assert.equal(m.encrypted, false);
  assert.equal(m.files[0].name, 'users.ndjson.gz');
  assert.equal((await verifyBackup({ store })).ok, true);
  const sink = new FakeSink({ projectId: 'p' });
  assert.equal((await restoreBackup({ store, sink })).totals.errors, 0);

  const dir2 = await tmp(t);
  const since = 1700000000000 + 4500;
  const inc = await exportBackup({ source, store: new DirStore(dir2), units: [{ id: 'questionBank', type: 'collection' }], since });
  assert.equal(inc.kind, 'incremental');
  assert.equal(inc.since, new Date(since).toISOString());
  assert.ok(source.calls.some((c) => c.since === since));
  assert.ok(inc.files[0].docs < 10, 'only documents changed after `since` are exported');
});

test('verify detects every kind of damage', async (t) => {
  const dir = await tmp(t);
  const store = new DirStore(dir);
  const units = BACKUP_UNITS.filter((u) => ['users', 'institutions'].includes(u.id));
  const m = await exportBackup({ source: new FakeSource(makeDataset({ questions: 5, withBlob: false })), store, units, masterKey: KEY, project: 'p' });
  const codes = async (opts = {}) => (await verifyBackup({ store, masterKey: KEY, ...opts })).problems.map((p) => p.code);
  assert.deepEqual(await codes(), []);

  assert.deepEqual(await codes({ masterKey: null }), ['KEY_REQUIRED']);
  const wrongKey = await verifyBackup({ store, masterKey: deriveMasterKey('another-secret-another-secret-123456') });
  assert.ok(wrongKey.problems.some((p) => p.code === 'UNREADABLE'), 'wrong key');

  const f = path.join(dir, m.files[0].name);
  const original = await readFile(f);
  const bad = Buffer.from(original); bad[bad.length - 20] ^= 1;
  await writeFile(f, bad);
  assert.ok((await codes()).includes('CHECKSUM_MISMATCH'), 'flipped byte');
  await writeFile(f, original.subarray(0, original.length - 5));
  const trunc = await codes();
  assert.ok(trunc.includes('SIZE_MISMATCH') && trunc.includes('CHECKSUM_MISMATCH'), 'truncated file');
  await writeFile(f, original);
  assert.deepEqual(await codes(), [], 'restored file verifies again');

  const manifestPath = path.join(dir, 'manifest.json');
  const mj = JSON.parse(await readFile(manifestPath, 'utf8'));
  mj.files[0].docs += 1;
  await writeFile(manifestPath, JSON.stringify(mj));
  assert.ok((await codes()).includes('COUNT_MISMATCH'), 'manifest says more documents than the file holds');
  mj.files[0].docs -= 1; mj.totals.docs += 5;
  await writeFile(manifestPath, JSON.stringify(mj));
  assert.ok((await codes()).includes('TOTAL_MISMATCH'));
  await rm(f);
  assert.ok((await codes()).includes('MISSING'));
  await rm(manifestPath);
  assert.deepEqual(await codes(), ['MANIFEST_UNREADABLE']);
  await writeFile(manifestPath, '{"format":"other"}');
  assert.deepEqual(await codes(), ['MANIFEST_INVALID']);
});

test('restore guards: cross-project, production confirmation, bad mode, damaged backup, dry run, unit filter', async (t) => {
  const dir = await tmp(t);
  const store = new DirStore(dir);
  const units = BACKUP_UNITS.filter((u) => ['users', 'institutions', 'memberships'].includes(u.id));
  const m = await exportBackup({ source: new FakeSource(makeDataset({ questions: 3, withBlob: false })), store, units, masterKey: KEY, project: 'tvexam' });

  await assert.rejects(() => restoreBackup({ store, sink: new FakeSink({ projectId: 'someone-else' }), masterKey: KEY }), (e) => e instanceof RestoreGuardError && e.code === 'CROSS_PROJECT');
  const other = new FakeSink({ projectId: 'someone-else' });
  assert.equal((await restoreBackup({ store, sink: other, masterKey: KEY, allowCrossProject: true })).totals.errors, 0, 'explicit override works');

  const prod = new FakeSink({ projectId: 'tvexam', isProduction: true });
  await assert.rejects(() => restoreBackup({ store, sink: prod, masterKey: KEY }), (e) => e.code === 'CONFIRMATION_REQUIRED');
  await assert.rejects(() => restoreBackup({ store, sink: prod, masterKey: KEY, confirm: 'yes' }), (e) => e.code === 'CONFIRMATION_REQUIRED');
  assert.equal(prod.writes, 0, 'nothing written before the guard passes');
  const dry = await restoreBackup({ store, sink: prod, masterKey: KEY, dryRun: true });
  assert.equal(dry.totals.written, m.totals.docs, 'a dry run needs no confirmation and reports what it would do');
  assert.equal(prod.writes, 0, 'dry run never writes');
  const real = await restoreBackup({ store, sink: prod, masterKey: KEY, confirm: 'RESTORE tvexam' });
  assert.equal(real.totals.written, m.totals.docs);

  await assert.rejects(() => restoreBackup({ store, sink: other, masterKey: KEY, mode: 'destroy-everything' }), (e) => e.code === 'BAD_MODE');
  const only = new FakeSink({ projectId: 'tvexam' });
  const filtered = await restoreBackup({ store, sink: only, masterKey: KEY, units: ['institutions'] });
  assert.deepEqual(Object.keys(filtered.units), ['institutions']);
  assert.ok([...only.docs.keys()].every((k) => k.startsWith('institutions/')));

  const f = path.join(dir, m.files[0].name);
  const bytes = await readFile(f); bytes[bytes.length - 3] ^= 1; await writeFile(f, bytes);
  await assert.rejects(() => restoreBackup({ store, sink: new FakeSink({ projectId: 'tvexam' }), masterKey: KEY }), (e) => e.code === 'BACKUP_INVALID', 'a damaged backup is never restored');
});

test('restore modes: skip-existing never overwrites newer data; overwrite replaces; merge combines', async (t) => {
  const dir = await tmp(t);
  const store = new DirStore(dir);
  await exportBackup({ source: new FakeSource({ users: [{ path: 'users/a', data: { name: 'from backup', keep: 1 } }, { path: 'users/b', data: { name: 'b' } }] }), store, units: [{ id: 'users', type: 'collection' }], project: 'p' });
  const make = () => { const s = new FakeSink({ projectId: 'p' }); s.docs.set('users/a', { name: 'NEWER LIVE DATA', extra: true }); return s; };

  const skip = make();
  const r1 = await restoreBackup({ store, sink: skip });
  assert.deepEqual([r1.totals.written, r1.totals.skipped], [1, 1]);
  assert.deepEqual(skip.docs.get('users/a'), { name: 'NEWER LIVE DATA', extra: true });
  assert.deepEqual(skip.docs.get('users/b'), { name: 'b' });

  const over = make();
  await restoreBackup({ store, sink: over, mode: 'overwrite' });
  assert.deepEqual(over.docs.get('users/a'), { name: 'from backup', keep: 1 });

  const merged = make();
  await restoreBackup({ store, sink: merged, mode: 'merge' });
  assert.deepEqual(merged.docs.get('users/a'), { name: 'from backup', extra: true, keep: 1 });
});

test('restore reports bad records and keeps going; a failing source aborts the export without leaving files', async (t) => {
  const dir = await tmp(t);
  const store = new DirStore(dir);
  const docs = { users: [{ path: 'users/ok1', data: { a: 1 } }, { path: 'users', data: { a: 2 } }, { path: 'users/x/y', data: { a: 3 } }, { path: 'users/ok2', data: { a: 4 } }] };
  await exportBackup({ source: new FakeSource(docs), store, units: [{ id: 'users', type: 'collection' }], project: 'p' });
  const sink = new FakeSink({ projectId: 'p' });
  const report = await restoreBackup({ store, sink });
  assert.deepEqual([report.totals.read, report.totals.written, report.totals.errors], [4, 2, 2]);
  assert.deepEqual([...sink.docs.keys()].sort(), ['users/ok1', 'users/ok2']);
  assert.ok(report.errors.every((e) => /Bad document path/.test(e.message)));

  const dir2 = await tmp(t);
  const failing = new FakeSource({ users: Array.from({ length: 10 }, (_, i) => ({ path: `users/u${i}`, data: { i } })) });
  failing.failAt = 3; failing.counter = 0;
  await assert.rejects(() => exportBackup({ source: failing, store: new DirStore(dir2), units: [{ id: 'users', type: 'collection' }] }), /source exploded/);
  assert.deepEqual(await readdir(dir2), [], 'no partial backup is left behind and no manifest is written');
});

// ------------------------------------------------------------------ target list vs firestore.rules
test('backup targets cover every collection and subcollection in firestore.rules (a new one cannot be forgotten)', () => {
  const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const literal = [...rules.matchAll(/^([ \t]+)match \/(\w+)\/\{\w+\}/gm)].map((m) => ({ name: m[2], nested: m[1].length >= 6 })); // indent 4 = top level, 6 = subcollection
  const academic = rules.match(/function isAcademic\(c\) \{ return c in \[([^\]]*)\]/)[1].split(',').map((s) => s.trim().replace(/'/g, ''));
  assert.equal(academic.length, 9);
  const top = new Set(literal.filter((l) => !l.nested && l.name !== 'databases').map((l) => l.name).concat(academic));
  const nested = new Set(literal.filter((l) => l.nested).map((l) => l.name));
  assert.deepEqual([...top].sort(), [...TOP_LEVEL_COLLECTIONS].sort(), 'top-level collections differ between firestore.rules and the backup target list');
  assert.deepEqual([...nested].sort(), [...SUBCOLLECTION_GROUPS].sort(), 'subcollections differ between firestore.rules and the backup target list');
  assert.equal(new Set(BACKUP_UNITS.map((u) => unitFileName(u, false))).size, BACKUP_UNITS.length, 'file names are unique');
});
