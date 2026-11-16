// Shared pieces of the per-engine generators.
import type { Basis, EngineId, ModelRope, ScalePlan } from "../types";
import { fmtFloat } from "../util";
import type { VllmBandId } from "../../rules";

export type BlockKind = "command" | "env" | "json" | "python" | "modelfile" | "note";

export interface Block {
  kind: BlockKind;
  /** i18n key suffix for the block heading ("block.<label>"). */
  label: string;
  /** Text to copy. For kind "note" this is a note code translated by the UI. */
  text: string;
}

export interface GenInput {
  model: ModelRope;
  plan: ScalePlan;
  modelName: string;
  vllmBand?: VllmBandId;
  /** llama.cpp only: the GGUF path to print after -m (default placeholder <model.gguf>). */
  modelPath?: string;
}

export interface GenOutput {
  engine: EngineId;
  blocks: Block[];
  /** Note codes (i18n "note.<code>"). */
  notes: string[];
  basis: Basis;
  sourceUrl: string;
  checked: string;
  band?: VllmBandId;
}

export interface RopeDictOptions {
  /** Include rope_theta inside the dict (needed by transformers 5 / vLLM >= 0.12 / SGLang). */
  theta?: number;
  /** Alternative key for the type ("rope_type" is the current name). */
  typeKey?: "rope_type" | "type";
}

/** Compact JSON text of a YaRN dict with Python-style floats ("factor":4.0). */
export function yarnDictJson(model: ModelRope, plan: ScalePlan, opts: RopeDictOptions = {}): string {
  const parts = [
    `"${opts.typeKey ?? "rope_type"}":"yarn"`,
    `"factor":${fmtFloat(plan.factor)}`,
    `"original_max_position_embeddings":${plan.originalCtx}`,
  ];
  // Keep author-chosen YaRN extras (mscale, beta_*) instead of silently dropping them.
  const ex = model.existing;
  if (ex && ex.type === "yarn") {
    for (const [k, v] of Object.entries(ex.extras)) parts.push(`"${k}":${typeof v === "number" ? v : String(v)}`);
  }
  if (opts.theta !== undefined) parts.push(`"rope_theta":${opts.theta}`);
  return `{${parts.join(",")}}`;
}

/** Join a command over several lines with backslash continuations. */
export function multiline(parts: string[]): string {
  return parts.join(" \\\n  ");
}

export function contextOnlyNotes(plan: ScalePlan): string[] {
  return plan.kind === "none" ? ["no-scaling-needed"] : plan.kind === "native-keep" ? ["native-keep"] : [];
}
