import type { EngineId, KvDtype } from "../types";

/** Engine-independent view of what a pasted command or config asks for. */
export interface ParsedConfig {
  engine: EngineId | "unknown";
  model?: string;
  /** Context length the command asks for (-c / --max-model-len / --context-length / num_ctx). */
  ctx?: number;
  /** Requested scaling. Present only when the command sets some RoPE scaling input. */
  scaling?: {
    type?: string;
    /** llama.cpp: --rope-scaling / LLAMA_ARG_ROPE_SCALING_TYPE was given. */
    typeExplicit: boolean;
    factor?: number;
    origCtx?: number;
    theta?: number;
  };
  /** Dict-style override (vLLM hf-overrides, SGLang json-model-override-args, transformers config). */
  override?: {
    key: "rope_scaling" | "rope_parameters";
    dict: Record<string, unknown>;
    maxPositionEmbeddings?: number;
    /** rope_theta given next to (not inside) the dict. */
    topLevelTheta?: number;
  };
  /** vLLM <= 0.11.0 style dedicated flags. */
  legacy?: { ropeScaling?: Record<string, unknown>; theta?: number };
  /** Flags this parser saw that the vLLM lint may call removed (names only). */
  removedFlags: string[];
  /** Ollama Modelfile RoPE parameter names. */
  ollamaRopeParams: string[];
  allowLongMaxLen: boolean;
  kvDtype?: KvDtype;
  errors: string[];
  /** Same errors as `errors`, as translatable code + params (parallel array). */
  errorInfo: { code: string; params: Record<string, string | number> }[];
}

export function emptyParsed(engine: ParsedConfig["engine"]): ParsedConfig {
  return { engine, removedFlags: [], ollamaRopeParams: [], allowLongMaxLen: false, errors: [], errorInfo: [] };
}
