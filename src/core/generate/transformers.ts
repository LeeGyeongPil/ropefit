import { ENGINE_META } from "../../rules";
import { fmtFloat } from "../util";
import { yarnDictJson } from "./common";
import type { GenInput, GenOutput } from "./common";

export function generateTransformers(input: GenInput): GenOutput {
  const { plan, model } = input;
  const meta = ENGINE_META.transformers;
  const base = { engine: "transformers" as const, basis: meta.basis, sourceUrl: meta.sourceUrl, checked: meta.checked };
  if (plan.kind !== "yarn") {
    return {
      ...base,
      blocks: [{ kind: "json", label: "json", text: `{"max_position_embeddings":${plan.targetCtx}}` }],
      notes: plan.kind === "none" ? ["no-scaling-needed"] : ["native-keep"],
    };
  }
  const dict = yarnDictJson(model, plan, { theta: model.ropeTheta });
  const parsed = JSON.parse(dict) as Record<string, number | string | boolean>;
  const pyEntries = Object.entries(parsed).map(([k, v]) => {
    const val = typeof v === "string" ? `"${v}"` : typeof v === "boolean" ? (v ? "True" : "False") : k === "factor" ? fmtFloat(v) : String(v);
    return `"${k}": ${val}`;
  });
  const python = [`config.rope_parameters = {${pyEntries.join(", ")}}`, `config.max_position_embeddings = ${plan.targetCtx}`].join("\n");
  return {
    ...base,
    blocks: [
      { kind: "python", label: "python", text: python },
      { kind: "json", label: "json", text: `{"rope_parameters":${dict},"max_position_embeddings":${plan.targetCtx}}` },
    ],
    notes: [...plan.notes],
  };
}
