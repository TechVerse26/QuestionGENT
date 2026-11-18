// Chunked AES-256-GCM for backup files, so large files stream with bounded memory and truncation/tampering is detected.
//   file := "EMBK1" | salt(16) | { len(4, BE) | ciphertext(len) | tag(16) }*
// A fresh key is derived per file (HKDF over the master key and the file's salt); the IV is the chunk counter; the
// additional authenticated data binds header, chunk index and a FINAL flag, so dropping or appending chunks fails.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

export class BackupCryptoError extends Error {}

const MAGIC = Buffer.from('EMBK1');
const SALT_LEN = 16;
const TAG_LEN = 16;
const DEFAULT_BLOCK = 1 << 20;
const MAX_BLOCK = 16 << 20;

export function deriveMasterKey(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new BackupCryptoError('The backup encryption secret must be at least 32 characters');
  return Buffer.from(hkdfSync('sha256', Buffer.from(secret), Buffer.alloc(0), Buffer.from('em-backup-master-v1'), 32));
}

const fileKey = (master, salt) => Buffer.from(hkdfSync('sha256', master, salt, Buffer.from('em-backup-file-v1'), 32));
const ivFor = (i) => { const b = Buffer.alloc(12); b.writeUInt32BE(i >>> 0, 8); return b; };
const aadFor = (header, i, isFinal) => { const idx = Buffer.alloc(4); idx.writeUInt32BE(i >>> 0); return Buffer.concat([header, idx, Buffer.from([isFinal ? 1 : 0])]); };

export async function* encryptStream(chunks, master, { blockSize = DEFAULT_BLOCK } = {}) {
  const salt = randomBytes(SALT_LEN);
  const header = Buffer.concat([MAGIC, salt]);
  const key = fileKey(master, salt);
  let index = 0;
  const seal = (plain, isFinal) => {
    const c = createCipheriv('aes-256-gcm', key, ivFor(index));
    c.setAAD(aadFor(header, index, isFinal));
    const ct = Buffer.concat([c.update(plain), c.final()]);
    const len = Buffer.alloc(4); len.writeUInt32BE(ct.length);
    index += 1;
    return Buffer.concat([len, ct, c.getAuthTag()]);
  };
  yield header;
  let pending = null;
  let buf = Buffer.alloc(0);
  for await (const chunk of chunks) {
    buf = buf.length ? Buffer.concat([buf, chunk]) : Buffer.from(chunk);
    while (buf.length > blockSize) { // strictly greater: the final block is never empty unless the whole input is empty
      if (pending) yield seal(pending, false);
      pending = buf.subarray(0, blockSize);
      buf = buf.subarray(blockSize);
    }
  }
  if (pending) yield seal(pending, false);
  yield seal(buf, true);
}

class ByteReader {
  constructor(iterable) { this.it = iterable[Symbol.asyncIterator](); this.buf = Buffer.alloc(0); this.done = false; }
  async fill(n) {
    while (this.buf.length < n && !this.done) {
      const { value, done } = await this.it.next();
      if (done) this.done = true; else this.buf = this.buf.length ? Buffer.concat([this.buf, value]) : Buffer.from(value);
    }
  }
  async read(n) { await this.fill(n); const out = this.buf.subarray(0, n); this.buf = this.buf.subarray(n); return out; }
  async hasMore() { await this.fill(1); return this.buf.length > 0; }
}

export async function* decryptStream(chunks, master) {
  const reader = new ByteReader(chunks);
  const header = await reader.read(MAGIC.length + SALT_LEN);
  if (header.length !== MAGIC.length + SALT_LEN || !header.subarray(0, MAGIC.length).equals(MAGIC)) throw new BackupCryptoError('Not an encrypted EXAM MASTER backup file');
  const key = fileKey(master, header.subarray(MAGIC.length));
  for (let index = 0; ; index += 1) {
    const lenBuf = await reader.read(4);
    if (lenBuf.length !== 4) throw new BackupCryptoError('Backup file is truncated');
    const len = lenBuf.readUInt32BE(0);
    if (len > MAX_BLOCK) throw new BackupCryptoError('Backup file is corrupted');
    const body = await reader.read(len + TAG_LEN);
    if (body.length !== len + TAG_LEN) throw new BackupCryptoError('Backup file is truncated');
    const isFinal = !(await reader.hasMore());
    try {
      const d = createDecipheriv('aes-256-gcm', key, ivFor(index));
      d.setAAD(aadFor(header, index, isFinal));
      d.setAuthTag(body.subarray(len));
      const plain = Buffer.concat([d.update(body.subarray(0, len)), d.final()]);
      if (plain.length) yield plain;
    } catch {
      throw new BackupCryptoError('Backup file is corrupted, truncated, or the key is wrong');
    }
    if (isFinal) return;
  }
}
