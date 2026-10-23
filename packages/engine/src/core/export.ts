import {
  type ExportFile,
  type ExportPack,
  type ExportPackReference,
  SPEC_VERSION,
} from '@opencharacter/spec';
import type { EngineError } from './load.ts';
import type { CharacterDoc } from './pack-types.ts';
import type { PackRelease } from './release.ts';

/** JSON as RFC 8785 writes it: object keys sorted by UTF-16 code units, no whitespace. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v ?? null)).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const K = Uint32Array.from(
  // The first 32 bits of the fractional parts of the cube roots of the first 64 primes.
  '428a2f98 71374491 b5c0fbcf e9b5dba5 3956c25b 59f111f1 923f82a4 ab1c5ed5 d807aa98 12835b01 243185be 550c7dc3 72be5d74 80deb1fe 9bdc06a7 c19bf174 e49b69c1 efbe4786 0fc19dc6 240ca1cc 2de92c6f 4a7484aa 5cb0a9dc 76f988da 983e5152 a831c66d b00327c8 bf597fc7 c6e00bf3 d5a79147 06ca6351 14292967 27b70a85 2e1b2138 4d2c6dfc 53380d13 650a7354 766a0abb 81c2c92e 92722c85 a2bfe8a1 a81a664b c24b8b70 c76c51a3 d192e819 d6990624 f40e3585 106aa070 19a4c116 1e376c08 2748774c 34b0bcb5 391c0cb3 4ed8aa4a 5b9cca4f 682e6ff3 748f82ee 78a5636f 84c87814 8cc70208 90befffa a4506ceb bef9a3f7 c67178f2'
    .split(' ')
    .map((h) => Number.parseInt(h, 16)),
);

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

type Eight = [number, number, number, number, number, number, number, number];

/** SHA-256 (FIPS 180-4). */
export function sha256(bytes: Uint8Array): Uint8Array {
  const length = bytes.length;
  const padded = new Uint8Array(Math.ceil((length + 9) / 64) * 64);
  padded.set(bytes);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(length / 0x20000000));
  view.setUint32(padded.length - 4, (length * 8) >>> 0);
  const h = Uint32Array.from([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  for (let block = 0; block < padded.length; block += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(block + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15] as number;
      const b = w[i - 2] as number;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = ((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = Array.from(h) as Eight;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const t1 = (hh + s1 + ((e & f) ^ (~e & g)) + (K[i] as number) + (w[i] as number)) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    const next = [a, b, c, d, e, f, g, hh];
    for (let i = 0; i < 8; i++) h[i] = ((h[i] as number) + (next[i] as number)) >>> 0;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i] as number);
  return out;
}

/** A release's export `integrity`: `sha256-` and the base64 SHA-256 of its canonical JSON. */
export function releaseIntegrity(release: PackRelease): string {
  const digest = sha256(new TextEncoder().encode(canonicalJson(release)));
  return `sha256-${btoa(String.fromCodePoint(...digest))}`;
}

export interface CreateExportOptions {
  /** Which packs to embed (a bundle): all (`true`), none (the default), or those it accepts. */
  embed?: boolean | ((release: PackRelease) => boolean);
  /** Where each referenced release can be fetched, if anywhere. */
  url?: (release: PackRelease) => string | undefined;
}

export type CreateExportResult =
  | { ok: true; export: ExportFile }
  | { ok: false; errors: EngineError[] };

const key = (id: string, version: string) => `${id}@${version}`;

/**
 * Builds an export of characters with every pack version they pin, each from `releases`, in the
 * order they are first pinned. Each pack has its `integrity`.
 */
export function createExport(
  characters: readonly CharacterDoc[],
  releases: readonly PackRelease[],
  options: CreateExportOptions = {},
): CreateExportResult {
  const errors: EngineError[] = [];
  const packs = new Map<string, ExportPack>();
  characters.forEach((character, i) => {
    character.packs.forEach((pin, j) => {
      if (packs.has(key(pin.id, pin.version))) return;
      const release = releases.find(
        (r) => r.manifest.id === pin.id && r.manifest.version === pin.version,
      );
      if (!release) {
        errors.push({
          code: 'unknown-id',
          data: { pack: pin.id, version: pin.version },
          path: `/characters/${i}/packs/${j}`,
        });
        return;
      }
      const integrity = releaseIntegrity(release);
      const embed =
        typeof options.embed === 'function' ? options.embed(release) : options.embed === true;
      const url = options.url?.(release);
      packs.set(
        key(pin.id, pin.version),
        embed
          ? { release: release as never, integrity }
          : { id: pin.id, version: pin.version, ...(url ? { url } : {}), integrity },
      );
    });
  });
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    export: {
      specVersion: SPEC_VERSION,
      characters: structuredClone([...characters]),
      packs: [...packs.values()],
    },
  };
}

export interface ReadExportResult {
  /** The release for each listed pack the export or the app has, in the export's order. */
  releases: PackRelease[];
  /**
   * Listed packs neither has: references the app has no matching copy of, to fetch from `url`
   * and check with releaseIntegrity, and embedded releases whose integrity doesn't match.
   */
  missing: ExportPack[];
}

/**
 * The releases an export's characters need. For each listed pack, the app's own copy of that ID
 * and version (`available`) when the entry has no `integrity` or the copy matches it; else the
 * embedded release, when it matches its `integrity`; else it is missing.
 */
export function readExport(file: ExportFile, available: readonly PackRelease[]): ReadExportResult {
  const releases: PackRelease[] = [];
  const missing: ExportPack[] = [];
  for (const entry of file.packs) {
    const embedded = 'release' in entry ? (entry.release as unknown as PackRelease) : undefined;
    const id = embedded?.manifest.id ?? (entry as ExportPackReference).id;
    const version = embedded?.manifest.version ?? (entry as ExportPackReference).version;
    const matches = (r: PackRelease) =>
      entry.integrity === undefined || releaseIntegrity(r) === entry.integrity;
    const own = available.find(
      (r) => r.manifest.id === id && r.manifest.version === version && matches(r),
    );
    if (own) releases.push(own);
    else if (embedded && matches(embedded)) releases.push(embedded);
    else missing.push(entry);
  }
  return { releases, missing };
}
