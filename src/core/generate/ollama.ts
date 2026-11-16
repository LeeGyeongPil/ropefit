import { ENGINE_META } from "../../rules";
import { generateLlamaCpp } from "./llamacpp";
import type { GenInput, GenOutput } from "./common";
import { yarnDictJson } from "./common";

/** Ollama has no runtime RoPE option (removed in v0.2.0): the answer is guidance, not a flag. */
export function generateOllama(input: GenInput): GenOutput {
  const { plan, model } = input;
  const meta = ENGINE_META.ollama;
  const base = { engine: "ollama" as const, basis: meta.basis, sourceUrl: meta.sourceUrl, checked: meta.checked };
  const modelfile = ["FROM ./model.gguf", `PARAMETER num_ctx ${plan.targetCtx}`].join("\n");
  const blocks: GenOutput["blocks"] = [
    { kind: "note", label: "note", text: "ollama-no-runtime" },
    { kind: "modelfile", label: "modelfile", text: modelfile },
  ];
  const notes = ["ollama-num-ctx-window-only"];
  if (plan.kind === "yarn") {
    // Settings must be inside the GGUF: edit config.json before convert_hf_to_gguf.py.
    blocks.push({ kind: "json", label: "convert-config", text: `{"rope_scaling":${yarnDictJson(model, plan)}}` });
    blocks.push({ kind: "command", label: "llamacpp-alternative", text: generateLlamaCpp(input).blocks[0]?.text ?? "" });
    notes.push("ollama-gguf-keys-cannot-be-added", ...plan.notes);
  } else {
    notes.push(plan.kind === "none" ? "no-scaling-needed" : "native-keep");
  }
  return { ...base, blocks, notes };
}
