// Static checks for a pasted serving command or config. Each rule maps to one silent mistake;
// rule metadata (severity, source URL, checked date) lives in src/rules/engines.json.
import { generate, renderText } from "./generate";
import { estimateKv } from "./kv";
import { parseCommand } from "./parse";
import { scalingFromDict } from "./parse/flags";
import type { ParsedConfig } from "./parse/types";
import { planScale } from "./plan";
import type { EngineId, Finding, KvDtype, ModelRope } from "./types";
import { asNumber, ceil2 } from "./util";
import { RULES, bandForVersion } from "../rules";
import type { VllmBand } from "../rules";

export interface LintContext {
  model: ModelRope | null;
  /** vLLM version text from the UI, e.g. "0.32". Unknown text means the newest band. */
  vllmVersion?: string;
  vramGiB?: number;
  kvDtype?: KvDtype;
}

export interface LintResult {
  parsed: ParsedConfig;
  findings: Finding[];
  band?: VllmBand;
  beyondChecked: boolean;
}

const NATIVE_TYPES = new Set(["llama3", "longrope", "su", "per-layer"]);
const EPS = 1e-9;

function finding(ruleId: string, params: Finding["params"], fix?: string): Finding {
  const meta = RULES[ruleId];
  if (!meta) throw new Error(`Unknown rule ${ruleId}: add it to src/rules/engines.json`);
  return { ruleId, severity: meta.severity, params, fix, sourceUrl: meta.sourceUrl, basis: meta.basis };
}

/** Rebuild the command the user probably meant, for rules where that is well defined. */
function correctedText(parsed: ParsedConfig, ctx: LintContext, band?: VllmBand): string | undefined {
  const model = ctx.model;
  if (!model || !parsed.ctx || parsed.engine === "unknown" || parsed.engine === "ollama") return undefined;
  const plan = planScale(model, parsed.ctx);
  if (plan.kind !== "yarn") return undefined;
  const out = generate(parsed.engine as EngineId, { model, plan, modelName: parsed.model ?? "<model>", modelPath: parsed.model, vllmBand: band?.id });
  if (parsed.engine === "transformers") return out.blocks.find((b) => b.kind === "json")?.text;
  return renderText({ ...out, blocks: out.blocks.slice(0, 1) }).trimEnd();
}

export function lintParsed(parsed: ParsedConfig, ctx: LintContext): Finding[] {
  const model = ctx.model;
  const engine = parsed.engine;
  const band = engine === "vllm" ? bandForVersion(ctx.vllmVersion).band : undefined;
  const bandId = band?.id;
  const modernVllm = bandId === "0.11.1" || bandId === "0.12-0.29" || bandId === "ge-0.30";

  let scaling = parsed.scaling;
  let override = parsed.override;
  if (engine === "vllm" && bandId === "le-0.11.0" && parsed.legacy?.ropeScaling) {
    scaling = scalingFromDict(parsed.legacy.ropeScaling, parsed.legacy.theta);
    override = { key: "rope_scaling", dict: parsed.legacy.ropeScaling, topLevelTheta: parsed.legacy.theta };
  }

  const out: Finding[] = [];
  const fixText = () => correctedText(parsed, ctx, band);

  // llama.cpp falls back to linear when the GGUF names no scaling type; vLLM/SGLang/transformers need a dict type.
  const existingType = model?.existing?.type;
  const type = scaling?.type ?? (engine === "llamacpp" && scaling?.factor !== undefined && existingType === "yarn" ? "yarn" : undefined);
  const factor = scaling?.factor;
  const scalingApplied = scaling !== undefined && (factor !== undefined || type !== undefined);

  // 1. Flags removed in vLLM 0.11.1.
  if (engine === "vllm" && modernVllm && parsed.removedFlags.length > 0) {
    out.push(finding("VLLM_REMOVED_FLAG", { flags: parsed.removedFlags.join(", "), version: ctx.vllmVersion ?? "" }, fixText()));
  }

  // 2. rope_theta dropped when an override replaces the whole rope dict.
  if (override) {
    const hasTheta = asNumber(override.dict.rope_theta) !== undefined;
    const vllmNeeds = engine === "vllm" && (bandId === "0.12-0.29" || bandId === "ge-0.30");
    const otherNeeds = (engine === "sglang" || engine === "transformers") && override.topLevelTheta === undefined;
    if (!hasTheta && (vllmNeeds || otherNeeds)) out.push(finding("THETA_MISSING", { key: override.key }, fixText()));
  }

  // 3. --rope-scale alone means linear interpolation in llama.cpp.
  if (engine === "llamacpp" && scaling && !scaling.typeExplicit && factor !== undefined && factor > 1 && existingType !== "yarn") {
    out.push(finding("LINEAR_TRAP", { factor }, fixText()));
  }

  // 4. Wrong or missing original (pre-training) length.
  if (model && type === "yarn") {
    const given = scaling?.origCtx;
    const expected = model.originalCtx;
    const effective = given ?? model.engineOrigDefault;
    if (effective !== expected) out.push(finding("ORIG_CTX_MISMATCH", { expected, got: effective, given: given === undefined ? "-" : given }, fixText()));
  }

  // 5. factor x original length must reach the requested context.
  if (model && parsed.ctx && factor !== undefined && factor > 1 && (type === "yarn" || type === "linear" || type === "dynamic" || type === undefined)) {
    const base = type === "yarn" ? (scaling?.origCtx ?? model.engineOrigDefault) : model.maxPositionEmbeddings;
    const capacity = factor * base;
    if (capacity < parsed.ctx - EPS) {
      out.push(finding("FACTOR_TOO_SMALL", { factor, base, capacity: Math.floor(capacity), ctx: parsed.ctx, need: ceil2(parsed.ctx / base) }, fixText()));
    }
  }

  // 6. Models with their own scheme must not be overridden.
  if (model?.existing && NATIVE_TYPES.has(model.existing.type) && scalingApplied) {
    out.push(finding("OVERRIDES_NATIVE", { type: model.existing.type }));
  }

  // 7. Overriding an author-provided YaRN replaces (not multiplies) their values.
  if (model?.existing?.type === "yarn" && scalingApplied) {
    const ex = model.existing;
    const lost: string[] = [];
    if (scaling?.origCtx !== undefined && ex.originalMaxPositionEmbeddings !== undefined && scaling.origCtx !== ex.originalMaxPositionEmbeddings) {
      lost.push("original_max_position_embeddings");
    }
    if (override) for (const k of Object.keys(ex.extras)) if (!(k in override.dict)) lost.push(k);
    if (lost.length > 0) out.push(finding("REPLACES_AUTHOR_VALUES", { lost: lost.join(", "), existingFactor: ex.factor ?? "" }));
  }

  // 8. Static YaRN costs short-input quality, so the factor should match the length you need.
  if (model && parsed.ctx && type === "yarn" && factor !== undefined && factor > 1 && !(model.existing?.type === "yarn" && model.existing.factor === factor)) {
    const orig = model.originalCtx; // true pre-training length; a wrong given value is reported by ORIG_CTX_MISMATCH
    const needed = ceil2(parsed.ctx / orig);
    if (factor > needed + EPS) out.push(finding("STATIC_YARN_OVERSIZED", { factor, needed, ctx: parsed.ctx }, fixText()));
  }

  // 9. vLLM >= 0.30 stopped multiplying max_position_embeddings by the YaRN factor.
  if (engine === "vllm" && bandId === "ge-0.30" && type === "yarn" && model && parsed.ctx && !parsed.allowLongMaxLen) {
    const cap = override?.maxPositionEmbeddings ?? model.maxPositionEmbeddings;
    if (parsed.ctx > cap) out.push(finding("VLLM_V030_MAXLEN", { ctx: parsed.ctx, cap }, fixText()));
  }

  // 10. Ollama ignores RoPE parameters in Modelfiles.
  if (engine === "ollama" && parsed.ollamaRopeParams.length > 0) {
    out.push(finding("OLLAMA_NO_RUNTIME_ROPE", { params: parsed.ollamaRopeParams.join(", ") }));
  }

  // 11. KV cache larger than the VRAM the user entered (weights come on top).
  if (model && parsed.ctx && ctx.vramGiB && ctx.vramGiB > 0) {
    const est = estimateKv(model, parsed.ctx, parsed.kvDtype ?? ctx.kvDtype ?? "bf16");
    if (est.supported && est.gib > ctx.vramGiB) {
      out.push(finding("KV_EXCEEDS_VRAM", { kv: est.gib.toFixed(2), vram: ctx.vramGiB, ctx: parsed.ctx }));
    }
  }

  const order = { error: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function lintText(text: string, ctx: LintContext, forced?: EngineId): LintResult {
  const parsed = parseCommand(text, forced);
  const v = parsed.engine === "vllm" ? bandForVersion(ctx.vllmVersion) : undefined;
  return { parsed, findings: parsed.engine === "unknown" ? [] : lintParsed(parsed, ctx), band: v?.band, beyondChecked: v?.beyondChecked ?? false };
}
