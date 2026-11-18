// File stores for backups. DirStore writes to a local directory (also what a CI job uploads as an artifact). Other
// providers (an S3-compatible bucket such as Backblaze B2) implement the same five methods.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile, readdir } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export class DirStore {
  constructor(dir) { this.dir = dir; }
  #file(name) {
    if (!SAFE_NAME.test(name) || name.includes('..')) throw new Error(`Unsafe file name: ${name}`);
    return path.join(this.dir, name);
  }
  async put(name, chunks) {
    await mkdir(this.dir, { recursive: true });
    const final = this.#file(name);
    const tmp = `${final}.tmp-${process.pid}-${Date.now()}`;
    const hash = createHash('sha256');
    let bytes = 0;
    const ws = createWriteStream(tmp);
    try {
      for await (const c of chunks) {
        hash.update(c); bytes += c.length;
        if (!ws.write(c)) await once(ws, 'drain');
      }
      await new Promise((resolve, reject) => ws.end((e) => (e ? reject(e) : resolve())));
      await rename(tmp, final);
    } catch (e) {
      ws.destroy();
      await rm(tmp, { force: true });
      throw e;
    }
    return { bytes, sha256: hash.digest('hex') };
  }
  get(name) { return createReadStream(this.#file(name)); }
  async exists(name) { try { await stat(this.#file(name)); return true; } catch { return false; } }
  async readJson(name) { return JSON.parse(await readFile(this.#file(name), 'utf8')); }
  async writeJson(name, obj) { await mkdir(this.dir, { recursive: true }); await writeFile(this.#file(name), `${JSON.stringify(obj, null, 2)}\n`); }
  async list() { try { return (await readdir(this.dir)).sort(); } catch { return []; } }
}
