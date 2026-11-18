// Lossless JSON encoding of Firestore values (Timestamp, GeoPoint, DocumentReference, Bytes, Vector, NaN, -0 ...).
// Recognises the Admin SDK classes by duck typing so this module needs no Firebase import; restore passes factories
// that build the real SDK classes. Unknown object types throw instead of being silently dropped.
export class TimestampLike {
  constructor(seconds, nanoseconds) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  toDate() { return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6)); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
}
export class GeoPointLike {
  constructor(latitude, longitude) { this.latitude = latitude; this.longitude = longitude; }
  isEqual(o) { return o && o.latitude === this.latitude && o.longitude === this.longitude; }
}
export class RefLike {
  constructor(path) { this.path = path; this.id = path.split('/').pop(); this.firestore = {}; }
}
export class VectorLike {
  constructor(values) { this._values = [...values]; }
  toArray() { return [...this._values]; }
}

export const PLAIN_FACTORIES = {
  timestamp: (s, n) => new TimestampLike(s, n),
  geopoint: (la, lo) => new GeoPointLike(la, lo),
  reference: (p) => new RefLike(p),
  bytes: (buf) => buf,
  vector: (arr) => new VectorLike(arr),
};

const isPlainObject = (v) => { const p = Object.getPrototypeOf(v); return p === Object.prototype || p === null; };

export function encodeValue(v) {
  if (v === null) return null;
  switch (typeof v) {
    case 'string': case 'boolean': return v;
    case 'number':
      if (Number.isNaN(v)) return { __t: 'num', v: 'NaN' };
      if (v === Infinity) return { __t: 'num', v: 'Infinity' };
      if (v === -Infinity) return { __t: 'num', v: '-Infinity' };
      if (Object.is(v, -0)) return { __t: 'num', v: '-0' };
      return v;
    case 'bigint': return { __t: 'bigint', v: v.toString() };
    case 'undefined': return undefined;
    case 'object': break;
    default: throw new Error(`Unsupported value type: ${typeof v}`);
  }
  if (v instanceof Date) { const ms = v.getTime(); return { __t: 'ts', s: Math.floor(ms / 1000), n: (((ms % 1000) + 1000) % 1000) * 1e6 }; }
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { __t: 'bytes', b64: Buffer.from(v).toString('base64') };
  if (typeof v.toDate === 'function' && Number.isFinite(v.seconds) && Number.isFinite(v.nanoseconds)) return { __t: 'ts', s: v.seconds, n: v.nanoseconds };
  if (typeof v.latitude === 'number' && typeof v.longitude === 'number' && typeof v.isEqual === 'function') return { __t: 'geo', lat: v.latitude, lng: v.longitude };
  if (typeof v.path === 'string' && typeof v.id === 'string' && v.firestore !== undefined) return { __t: 'ref', p: v.path };
  if (typeof v.toArray === 'function' && !Array.isArray(v)) return { __t: 'vec', v: v.toArray() };
  if (Array.isArray(v)) return v.map((x) => { const e = encodeValue(x); return e === undefined ? null : e; });
  if (!isPlainObject(v)) throw new Error(`Unsupported object type: ${v.constructor?.name}`);
  const out = {};
  for (const [k, x] of Object.entries(v)) { const e = encodeValue(x); if (e !== undefined) out[k] = e; }
  return Object.prototype.hasOwnProperty.call(v, '__t') ? { __t: 'map', v: out } : out; // a user field literally named "__t" must not be mistaken for a marker
}

export function decodeValue(v, f = PLAIN_FACTORIES) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => decodeValue(x, f));
  if (typeof v.__t === 'string') {
    switch (v.__t) {
      case 'num': return v.v === 'NaN' ? NaN : v.v === 'Infinity' ? Infinity : v.v === '-Infinity' ? -Infinity : -0;
      case 'bigint': return BigInt(v.v);
      case 'ts': return f.timestamp(v.s, v.n);
      case 'bytes': return f.bytes(Buffer.from(v.b64, 'base64'));
      case 'geo': return f.geopoint(v.lat, v.lng);
      case 'ref': return f.reference(v.p);
      case 'vec': return f.vector(v.v);
      case 'map': { const o = {}; for (const [k, x] of Object.entries(v.v)) o[k] = decodeValue(x, f); return o; }
      default: throw new Error(`Unknown value marker: ${v.__t}`);
    }
  }
  const o = {};
  for (const [k, x] of Object.entries(v)) o[k] = decodeValue(x, f);
  return o;
}
