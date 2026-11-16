import { ENGINE_META } from "../../rules";
import { shellQuote } from "../util";
import { contextOnlyNotes, multiline, yarnDictJson } from "./common";
import type { GenInput, GenOutput } from "./common";

export function generateSglang(input: GenInput): GenOutput {
  const { plan, model, modelName } = input;
  const meta = ENGINE_META.sglang;
  const base = { engine: "sglang" as const, basis: meta.basis, sourceUrl: meta.sourceUrl, checked: meta.checked };
  const head = `python -m sglang.launch_server --model-path ${shellQuote(modelName)}`;
  if (plan.kind !== "yarn") {
    return { ...base, blocks: [{ kind: "command", label: "command", text: multiline([head, `--context-length ${plan.targetCtx}`]) }], notes: contextOnlyNotes(plan) };
  }
  // rope_scaling is the same object as rope_parameters in transformers 5; rope_theta rides inside it.
  const override = `{"rope_scaling":${yarnDictJson(model, plan, { theta: model.ropeTheta })}}`;
  return {
    ...base,
    blocks: [{ kind: "command", label: "command", text: multiline([head, `--json-model-override-args '${override}'`, `--context-length ${plan.targetCtx}`]) }],
    notes: [...plan.notes],
  };
}
