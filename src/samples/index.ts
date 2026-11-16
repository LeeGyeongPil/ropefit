// Built-in practice (mock) models: only the numeric fields that matter for RoPE and KV math.
import qwen from "./qwen3-8b.json";
import llama from "./llama-3.2-1b-instruct.json";
import deepseek from "./deepseek-v3.json";
import layered from "./layered-example.json";
import { normalizeConfig } from "../core/normalize";
import type { ModelRope } from "../core/types";

export interface Sample {
  id: string;
  name: string;
  sourceUrl: string;
  checked: string;
  synthetic: boolean;
  config: unknown;
}

export const SAMPLES: Sample[] = [qwen, llama, deepseek, layered] as Sample[];

export const DEFAULT_SAMPLE_ID = "qwen3-8b";

export function getSample(id: string): Sample {
  const s = SAMPLES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown sample "${id}". Known: ${SAMPLES.map((x) => x.id).join(", ")}`);
  return s;
}

export function loadSample(id: string): ModelRope {
  return normalizeConfig(getSample(id).config, { source: "sample" });
}
