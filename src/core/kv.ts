// KV cache size estimate: 2 (K and V) x layers x kv_heads x head_dim x bytes x tokens.
import type { KvDtype, ModelRope } from "./types";

export const KV_DTYPES: KvDtype[] = ["bf16", "fp16", "fp8", "q8_0", "q4_0", "f32"];

const BYTES: Record<KvDtype, number> = { f32: 4, bf16: 2, fp16: 2, fp8: 1, q8_0: 34 / 32, q4_0: 18 / 32 };

export interface KvEstimate {
  supported: boolean;
  reason?: "mla" | "sliding" | "unknown-shape";
  gib: number;
}

export function estimateKv(model: ModelRope, tokens: number, dtype: KvDtype): KvEstimate {
  const kv = model.kv;
  if (!kv) return { supported: false, reason: "unknown-shape", gib: 0 };
  if (kv.mla) return { supported: false, reason: "mla", gib: 0 };
  if (kv.sliding) return { supported: false, reason: "sliding", gib: 0 };
  const bytes = 2 * kv.layers * kv.kvHeads * kv.headDim * BYTES[dtype] * tokens;
  return { supported: true, gib: bytes / 1024 ** 3 };
}
