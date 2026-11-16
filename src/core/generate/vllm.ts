import { bandById } from "../../rules";
import type { VllmBandId } from "../../rules";
import { shellQuote } from "../util";
import { contextOnlyNotes, multiline, yarnDictJson } from "./common";
import type { GenInput, GenOutput } from "./common";

export const DEFAULT_VLLM_BAND: VllmBandId = "ge-0.30";

export function generateVllm(input: GenInput): GenOutput {
  const { plan, model, modelName } = input;
  const bandId = input.vllmBand ?? DEFAULT_VLLM_BAND;
  const band = bandById(bandId);
  const ctx = plan.targetCtx;
  const base = { engine: "vllm" as const, basis: band.basis, sourceUrl: band.sourceUrl, checked: band.checked, band: bandId };
  const head = `vllm serve ${shellQuote(modelName)}`;
  if (plan.kind !== "yarn") {
    return {
      ...base,
      blocks: [{ kind: "command", label: "command", text: multiline([head, `--max-model-len ${ctx}`]) }],
      notes: contextOnlyNotes(plan),
    };
  }
  const theta = model.ropeTheta;
  let flags: string[];
  const notes = [...plan.notes];
  switch (bandId) {
    case "le-0.11.0":
      // Dedicated flags existed until v0.11.0.
      flags = [`--rope-scaling '${yarnDictJson(model, plan)}'`, `--rope-theta ${theta}`];
      break;
    case "0.11.1":
      // Flags removed (PR #28006); internal name is still rope_scaling.
      flags = [`--hf-overrides '{"rope_scaling":${yarnDictJson(model, plan)}}'`];
      break;
    case "0.12-0.29":
      // Internal name is rope_parameters; rope_theta must travel with it or it is dropped.
      flags = [`--hf-overrides '{"rope_parameters":${yarnDictJson(model, plan, { theta })}}'`];
      break;
    default:
      // Since v0.30 the length cap is not multiplied by the factor, so max_position_embeddings is raised too.
      flags = [`--hf-overrides '{"rope_parameters":${yarnDictJson(model, plan, { theta })},"max_position_embeddings":${ctx}}'`];
      notes.push("vllm-v030-source-based");
  }
  return {
    ...base,
    blocks: [{ kind: "command", label: "command", text: multiline([head, ...flags, `--max-model-len ${ctx}`]) }],
    notes,
  };
}
