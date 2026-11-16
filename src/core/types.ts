// Shared types for the pure-TypeScript core (no React, no DOM).

export type EngineId = "llamacpp" | "vllm" | "sglang" | "transformers" | "ollama";
export type Basis = "source" | "docs";
export type Severity = "error" | "warning" | "info";
export type KvDtype = "f32" | "bf16" | "fp16" | "fp8" | "q8_0" | "q4_0";

/** Scaling that the model files already carry (config.json rope_scaling / GGUF keys). */
export interface ExistingScaling {
  /** "yarn" | "linear" | "dynamic" | "llama3" | "longrope" | "per-layer" | other */
  type: string;
  factor?: number;
  originalMaxPositionEmbeddings?: number;
  /** Author-chosen extra keys (mscale, beta_fast, ...) so overrides can be checked against them. */
  extras: Record<string, number | boolean>;
  perLayer: boolean;
}

export interface KvShape {
  layers: number;
  kvHeads: number;
  headDim: number;
  /** Multi-head latent attention (DeepSeek): compressed cache, not estimated. */
  mla: boolean;
  /** Sliding-window layers: cache is not linear in length, not estimated. */
  sliding: boolean;
}

export type OriginalCtxSource = "config" | "gguf" | "known-model" | "max_position_embeddings" | "user";

export interface ModelRope {
  source: "hf" | "paste" | "gguf" | "sample";
  modelType?: string;
  ropeTheta: number;
  maxPositionEmbeddings: number;
  /** Pre-training length used as the base of the scale factor. */
  originalCtx: number;
  originalCtxSource: OriginalCtxSource;
  /** What an engine falls back to when the command gives no original length. */
  engineOrigDefault: number;
  existing: ExistingScaling | null;
  rotaryDim: number;
  kv?: KvShape;
  /** Codes shown as notes in the UI (see i18n "note.<code>"). */
  notes: string[];
}

export interface ScalePlan {
  kind: "none" | "yarn" | "native-keep";
  factor: number;
  targetCtx: number;
  originalCtx: number;
  notes: string[];
}

export interface EngineTarget {
  engine: EngineId;
  version?: string;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  params: Record<string, string | number>;
  fix?: string;
  sourceUrl: string;
  basis: Basis;
}

export class HfFetchError extends Error {
  code: "invalid-id" | "not-found" | "gated" | "http" | "network" | "bad-json";
  constructor(code: HfFetchError["code"], message: string) {
    super(message);
    this.name = "HfFetchError";
    this.code = code;
  }
}

export type ErrParams = Record<string, string | number>;

/** Errors below carry a stable code plus params so the UI can translate them; the message stays English for library use. */
export class GgufParseError extends Error {
  code: string;
  params: ErrParams;
  constructor(message: string, code = "generic", params: ErrParams = {}) {
    super(message);
    this.name = "GgufParseError";
    this.code = code;
    this.params = params;
  }
}

export class ConfigShapeError extends Error {
  code: string;
  params: ErrParams;
  constructor(message: string, code = "generic", params: ErrParams = {}) {
    super(message);
    this.name = "ConfigShapeError";
    this.code = code;
    this.params = params;
  }
}

export class ShellParseError extends Error {
  code: string;
  constructor(message: string, code = "generic") {
    super(message);
    this.name = "ShellParseError";
    this.code = code;
  }
}
