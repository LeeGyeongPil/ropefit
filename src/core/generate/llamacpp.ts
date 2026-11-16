import { ENGINE_META } from "../../rules";
import { shellQuote } from "../util";
import { contextOnlyNotes } from "./common";
import type { GenInput, GenOutput } from "./common";

export function generateLlamaCpp(input: GenInput): GenOutput {
  const { plan } = input;
  const ctx = plan.targetCtx;
  const meta = ENGINE_META.llamacpp;
  const base = { engine: "llamacpp" as const, basis: meta.basis, sourceUrl: meta.sourceUrl, checked: meta.checked };
  const gguf = input.modelPath ?? "<model.gguf>";
  if (plan.kind !== "yarn") {
    return {
      ...base,
      blocks: [
        { kind: "command", label: "command", text: `llama-server -m ${gguf} -c ${ctx}` },
        { kind: "env", label: "env", text: `LLAMA_ARG_CTX_SIZE=${ctx}` },
      ],
      notes: contextOnlyNotes(plan),
    };
  }
  const args = ["-m", gguf, "-c", String(ctx), "--rope-scaling", "yarn", "--rope-scale", String(plan.factor), "--yarn-orig-ctx", String(plan.originalCtx)];
  return {
    ...base,
    blocks: [
      { kind: "command", label: "command", text: `llama-server ${args.map(shellQuote).join(" ")}` },
      {
        kind: "env",
        label: "env",
        text: [
          `LLAMA_ARG_CTX_SIZE=${ctx}`,
          "LLAMA_ARG_ROPE_SCALING_TYPE=yarn",
          `LLAMA_ARG_ROPE_SCALE=${plan.factor}`,
          `LLAMA_ARG_YARN_ORIG_CTX=${plan.originalCtx}`,
        ].join("\n"),
      },
    ],
    notes: [...plan.notes],
  };
}
