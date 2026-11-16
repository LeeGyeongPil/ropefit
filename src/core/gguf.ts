// Minimal GGUF v2/v3 header reader. Reads only the key/value section (never tensor data)
// from a Blob/File using slices, so multi-GB model files are not loaded.
import { GgufParseError } from "./types";
import type { ModelRope } from "./types";
import { ConfigShapeError } from "./types";
import { knownOriginalCtx } from "./normalize";
import { asNumber } from "./util";

/** Anything with a size and slice().arrayBuffer(): Blob, File, or a test double. */
export interface ByteSource {
  size: number;
  slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
}

export type GgufValue = string | number | boolean | { array: number };

export interface GgufInfo {
  version: number;
  arch: string;
  tensorCount: number;
  kv: Record<string, GgufValue>;
  /** Highest byte offset requested from the source (proves tensor data was not read). */
  bytesRead: number;
}

const WINDOW = 256 * 1024;
const MAX_STRING = 16 * 1024 * 1024;
const MAX_KV = 100_000;

class Reader {
  private buf = new Uint8Array(0);
  private bufStart = 0;
  pos = 0;
  bytesRead = 0;
  constructor(private src: ByteSource) {}

  private async ensure(n: number): Promise<void> {
    const end = this.pos + n;
    if (end > this.src.size) throw new GgufParseError("File ends inside the GGUF header (truncated file?). Re-download the model file.", "truncated");
    if (this.pos >= this.bufStart && end <= this.bufStart + this.buf.length) return;
    const fetchEnd = Math.min(this.src.size, this.pos + Math.max(n, WINDOW));
    const data = new Uint8Array(await this.src.slice(this.pos, fetchEnd).arrayBuffer());
    this.buf = data;
    this.bufStart = this.pos;
    this.bytesRead = Math.max(this.bytesRead, fetchEnd);
  }

  async view(n: number): Promise<DataView> {
    await this.ensure(n);
    const off = this.pos - this.bufStart;
    this.pos += n;
    return new DataView(this.buf.buffer, this.buf.byteOffset + off, n);
  }

  async u8() { return (await this.view(1)).getUint8(0); }
  async u32() { return (await this.view(4)).getUint32(0, true); }
  async u64(): Promise<number> {
    const v = (await this.view(8)).getBigUint64(0, true);
    if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new GgufParseError("GGUF header contains an implausibly large number.", "huge-number");
    return Number(v);
  }
  async string(): Promise<string> {
    const len = await this.u64();
    if (len > MAX_STRING) throw new GgufParseError("GGUF header contains an implausibly long string (not a GGUF file?).", "long-string");
    await this.ensure(len);
    const off = this.pos - this.bufStart;
    const s = new TextDecoder().decode(this.buf.subarray(off, off + len));
    this.pos += len;
    return s;
  }
  skip(n: number) {
    this.pos += n;
    if (this.pos > this.src.size) throw new GgufParseError("File ends inside the GGUF header (truncated file?). Re-download the model file.", "truncated");
  }
}

const FIXED_SIZE: Record<number, number> = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8 };

async function readScalar(r: Reader, type: number): Promise<number | boolean | string> {
  switch (type) {
    case 0: return (await r.u8());
    case 1: { const v = await r.u8(); return v > 127 ? v - 256 : v; }
    case 2: { const v = await r.u8(); return v + (await r.u8()) * 256; }
    case 3: { const lo = await r.u8(); const hi = await r.u8(); const v = lo + hi * 256; return v > 32767 ? v - 65536 : v; }
    case 4: return r.u32();
    case 5: { const v = await r.u32(); return v > 2147483647 ? v - 4294967296 : v; }
    case 6: {
      const dv = await r.view(4);
      return dv.getFloat32(0, true);
    }
    case 7: return (await r.u8()) !== 0;
    case 8: return r.string();
    case 10: return r.u64();
    case 11: { const dv = await r.view(8); return Number(dv.getBigInt64(0, true)); }
    case 12: { const dv = await r.view(8); return dv.getFloat64(0, true); }
    default: throw new GgufParseError(`Unknown GGUF value type ${type}. The file may be corrupt or newer than this reader.`, "unknown-type", { type });
  }
}

export async function readGgufHeader(src: ByteSource): Promise<GgufInfo> {
  const r = new Reader(src);
  if (src.size < 24) throw new GgufParseError("This file is too small to be a GGUF model. Pick a .gguf file.", "too-small");
  const magic = await r.u32();
  if (magic !== 0x46554747) throw new GgufParseError('Not a GGUF file (missing "GGUF" magic bytes). Pick a .gguf model file.', "bad-magic");
  const version = await r.u32();
  if (version !== 2 && version !== 3) throw new GgufParseError(`Unsupported GGUF version ${version}. This reader supports versions 2 and 3.`, "bad-version", { version });
  const tensorCount = await r.u64();
  const kvCount = await r.u64();
  if (kvCount > MAX_KV) throw new GgufParseError("GGUF header declares too many metadata entries (corrupt file?).", "too-many");
  const kv: Record<string, GgufValue> = {};
  for (let i = 0; i < kvCount; i++) {
    const key = await r.string();
    const type = await r.u32();
    if (type === 9) {
      const elemType = await r.u32();
      const len = await r.u64();
      const fixed = FIXED_SIZE[elemType];
      if (fixed !== undefined) r.skip(fixed * len);
      else if (elemType === 8) for (let j = 0; j < len; j++) { const sl = await r.u64(); r.skip(sl); }
      else throw new GgufParseError(`Unsupported array element type ${elemType} for key "${key}".`, "array-type", { type: elemType, key });
      kv[key] = { array: len };
    } else {
      kv[key] = await readScalar(r, type);
    }
  }
  const arch = kv["general.architecture"];
  if (typeof arch !== "string") throw new GgufParseError('GGUF header has no "general.architecture" entry.', "no-arch");
  return { version, arch, tensorCount, kv, bytesRead: r.bytesRead };
}

/** Convenience wrapper for File/Blob inputs. */
export function readGgufFile(file: Blob): Promise<GgufInfo> {
  return readGgufHeader(file);
}

export interface GgufRope {
  arch: string;
  contextLength?: number;
  freqBase?: number;
  scalingType?: string;
  scalingFactor?: number;
  originalContextLength?: number;
}

export function ggufRope(info: GgufInfo): GgufRope {
  const get = (k: string) => info.kv[`${info.arch}.${k}`];
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    arch: info.arch,
    contextLength: asNumber(get("context_length")),
    freqBase: asNumber(get("rope.freq_base")),
    scalingType: str(get("rope.scaling.type")),
    scalingFactor: asNumber(get("rope.scaling.factor")),
    originalContextLength: asNumber(get("rope.scaling.original_context_length")),
  };
}

export function modelFromGguf(info: GgufInfo): ModelRope {
  const rope = ggufRope(info);
  if (rope.contextLength === undefined) {
    throw new ConfigShapeError(`GGUF header has no "${info.arch}.context_length". This file is not a usual language-model GGUF.`, "no-context", { arch: info.arch });
  }
  const notes: string[] = [];
  const get = (k: string) => asNumber(info.kv[`${info.arch}.${k}`]);
  const theta = rope.freqBase ?? 10000;
  if (rope.freqBase === undefined) notes.push("gguf-default-theta");
  let existing: ModelRope["existing"] = null;
  if (rope.scalingType && rope.scalingType !== "none") {
    existing = { type: rope.scalingType, factor: rope.scalingFactor, originalMaxPositionEmbeddings: rope.originalContextLength, extras: {}, perLayer: false };
  } else if (rope.scalingType === undefined) {
    // llama.cpp treats a missing rope.scaling.type as linear when --rope-scale is given.
    notes.push("gguf-no-scaling-keys");
  }
  let originalCtx: number;
  let source: ModelRope["originalCtxSource"];
  const knownOrig = knownOriginalCtx(info.arch);
  if (rope.originalContextLength !== undefined) { originalCtx = rope.originalContextLength; source = "gguf"; }
  else if (knownOrig !== undefined) { originalCtx = knownOrig; source = "known-model"; }
  else { originalCtx = rope.contextLength; source = "max_position_embeddings"; }

  const heads = get("attention.head_count");
  const emb = get("embedding_length");
  const keyLen = get("attention.key_length");
  const dimCount = get("rope.dimension_count");
  const headDim = keyLen ?? (emb && heads ? emb / heads : undefined);
  let rotaryDim = dimCount ?? headDim;
  if (rotaryDim === undefined) { rotaryDim = 128; notes.push("gguf-rotary-dim-assumed"); }
  const layers = get("block_count");
  const kvHeads = get("attention.head_count_kv") ?? heads;
  return {
    source: "gguf",
    modelType: info.arch,
    ropeTheta: theta,
    maxPositionEmbeddings: rope.contextLength,
    originalCtx,
    originalCtxSource: source,
    engineOrigDefault: rope.originalContextLength ?? rope.contextLength,
    existing,
    rotaryDim,
    kv: layers !== undefined && kvHeads !== undefined && headDim !== undefined
      ? { layers, kvHeads, headDim, mla: false, sliding: false }
      : undefined,
    notes,
  };
}
