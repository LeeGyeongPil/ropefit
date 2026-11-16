import type { EngineId } from "../types";
import type { GenInput, GenOutput } from "./common";
import { generateLlamaCpp } from "./llamacpp";
import { generateOllama } from "./ollama";
import { generateSglang } from "./sglang";
import { generateTransformers } from "./transformers";
import { generateVllm } from "./vllm";

export type { Block, GenInput, GenOutput } from "./common";
export { DEFAULT_VLLM_BAND } from "./vllm";

export function generate(engine: EngineId, input: GenInput): GenOutput {
  switch (engine) {
    case "llamacpp": return generateLlamaCpp(input);
    case "vllm": return generateVllm(input);
    case "sglang": return generateSglang(input);
    case "transformers": return generateTransformers(input);
    case "ollama": return generateOllama(input);
  }
}

/** Plain-text rendering used by the golden files; note blocks show their code. */
export function renderText(out: GenOutput): string {
  return out.blocks.map((b) => (b.kind === "note" ? `# [${b.text}]` : b.text)).join("\n\n") + "\n";
}
