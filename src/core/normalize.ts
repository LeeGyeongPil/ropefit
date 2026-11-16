// Turn a Hugging Face config.json (legacy rope_scaling, transformers 5 rope_parameters,
// per-layer nested forms) or GGUF metadata into one ModelRope.
import known from "./knownModels.json";
import { ConfigShapeError } from "./types";
import type { ExistingScaling, KvShape, ModelRope, OriginalCtxSource } from "./types";
import { asNumber, isRecord } from "./util";

const LAYER_KEYS = ["full_attention", "sliding_attention", "global_attention", "local_attention"];
const EXTRA_KEYS = ["mscale", "mscale_all_dim", "beta_fast", "beta_slow", "attention_factor", "truncate"];

interface KnownEntry {
  originalCtx: number;
}
const KNOWN = known.models as Record<string, KnownEntry>;

export function knownOriginalCtx(modelType: string | undefined): number | undefined {
  return modelType ? KNOWN[modelType]?.originalCtx : undefined;
}

function existingFrom(rp: Record<string, unknown>): ExistingScaling | null {
  const type = String(rp.rope_type ?? rp.type ?? "default");
  if (type === "default") return null;
  const extras: Record<string, number | boolean> = {};
  for (const k of EXTRA_KEYS) {
    const v = rp[k];
    if (typeof v === "number" || typeof v === "boolean") extras[k] = v;
  }
  return {
    type,
    factor: asNumber(rp.factor),
    originalMaxPositionEmbeddings: asNumber(rp.original_max_position_embeddings),
    extras,
    perLayer: false,
  };
}

function need(cfg: Record<string, unknown>, key: string): number {
  const v = asNumber(cfg[key]);
  if (v === undefined || v <= 0) {
    throw new ConfigShapeError(`config.json is missing a positive number for "${key}". Paste the full config.json of the model (the file next to the weights).`, "missing-key", { key });
  }
  return v;
}

export function normalizeConfig(input: unknown, opts: { source?: ModelRope["source"] } = {}): ModelRope {
  if (!isRecord(input)) {
    throw new ConfigShapeError("config.json must be a JSON object. Paste the whole file, starting with '{'.", "not-object");
  }
  // Multimodal configs keep the language model settings under text_config.
  const cfg: Record<string, unknown> = isRecord(input.text_config) ? { ...input, ...input.text_config } : input;
  const modelType = typeof cfg.model_type === "string" ? cfg.model_type : undefined;
  const maxPos = need(cfg, "max_position_embeddings");

  const rpRaw = cfg.rope_parameters ?? cfg.rope_scaling;
  let theta: number | undefined;
  let existing: ExistingScaling | null = null;
  let partialRotary = asNumber(cfg.partial_rotary_factor);
  if (isRecord(rpRaw)) {
    const layerEntries = LAYER_KEYS.filter((k) => isRecord(rpRaw[k]));
    if (layerEntries.length > 0) {
      const first = (isRecord(rpRaw.full_attention) ? rpRaw.full_attention : rpRaw[layerEntries[0] as string]) as Record<string, unknown>;
      theta = asNumber(first.rope_theta);
      const anyScaled = layerEntries.some((k) => existingFrom(rpRaw[k] as Record<string, unknown>) !== null);
      const firstExisting = layerEntries.map((k) => existingFrom(rpRaw[k] as Record<string, unknown>)).find((e) => e !== null) ?? null;
      existing = anyScaled
        ? { type: "per-layer", factor: firstExisting?.factor, originalMaxPositionEmbeddings: firstExisting?.originalMaxPositionEmbeddings, extras: {}, perLayer: true }
        : null;
    } else {
      theta = asNumber(rpRaw.rope_theta);
      existing = existingFrom(rpRaw);
      partialRotary = partialRotary ?? asNumber(rpRaw.partial_rotary_factor);
    }
  }
  theta = theta ?? asNumber(cfg.rope_theta);
  if (theta === undefined || theta <= 0) {
    throw new ConfigShapeError(`config.json has no "rope_theta" (neither at the top level nor inside rope_parameters). Add it from the model card or paste the original file.`, "no-theta");
  }

  // Rotary dimension: MLA models rotate only qk_rope_head_dim; others head_dim x partial_rotary_factor.
  const heads = asNumber(cfg.num_attention_heads);
  const hidden = asNumber(cfg.hidden_size);
  const headDim = asNumber(cfg.head_dim) ?? (hidden && heads ? hidden / heads : undefined);
  const mlaRope = asNumber(cfg.qk_rope_head_dim);
  if (headDim === undefined && mlaRope === undefined) {
    throw new ConfigShapeError(`config.json needs "head_dim" or both "hidden_size" and "num_attention_heads" to compute the rotary dimension.`, "no-head-dim");
  }
  const rotaryDim = mlaRope ?? Math.round((headDim as number) * (partialRotary ?? 1));

  // Original (pre-training) length: config keys first, then the known-model table, then max_position_embeddings.
  let originalCtx: number;
  let originalCtxSource: OriginalCtxSource;
  const cfgOrig = existing?.originalMaxPositionEmbeddings ?? asNumber(cfg.original_max_position_embeddings);
  const knownOrig = knownOriginalCtx(modelType);
  if (cfgOrig !== undefined) {
    originalCtx = cfgOrig;
    originalCtxSource = "config";
  } else if (knownOrig !== undefined) {
    originalCtx = knownOrig;
    originalCtxSource = "known-model";
  } else {
    originalCtx = maxPos;
    originalCtxSource = "max_position_embeddings";
  }

  let kv: KvShape | undefined;
  const layers = asNumber(cfg.num_hidden_layers);
  const kvHeads = asNumber(cfg.num_key_value_heads) ?? heads;
  if (layers !== undefined && kvHeads !== undefined) {
    const layerTypes = Array.isArray(cfg.layer_types) ? cfg.layer_types : [];
    kv = {
      layers,
      kvHeads,
      headDim: headDim ?? rotaryDim,
      mla: asNumber(cfg.kv_lora_rank) !== undefined,
      sliding: cfg.use_sliding_window === true || layerTypes.includes("sliding_attention"),
    };
  }

  return {
    source: opts.source ?? "paste",
    modelType,
    ropeTheta: theta,
    maxPositionEmbeddings: maxPos,
    originalCtx,
    originalCtxSource,
    engineOrigDefault: cfgOrig ?? maxPos,
    existing,
    rotaryDim,
    kv,
    notes: originalCtxSource === "max_position_embeddings" && !existing ? ["orig-unverified"] : [],
  };
}
