import { asNumber } from "../util";
import { applyOverrideObject, flagValue, hasFlag, parseFlags, parseJsonArg, parseKvDtype, parseLength, parseNumber } from "./flags";
import { emptyParsed } from "./types";
import type { ParsedConfig } from "./types";

/** words = arguments after "vllm serve" (or after the api_server module). */
export function parseVllm(words: string[], env: Record<string, string>): ParsedConfig {
  const out = emptyParsed("vllm");
  const { flags, positionals } = parseFlags(words);
  out.model = flagValue(flags, "--model") ?? (words[0] && !words[0].startsWith("-") ? words[0] : positionals[0]);
  out.ctx = parseLength(flagValue(flags, "--max-model-len"));
  out.allowLongMaxLen = ["1", "true", "True"].includes(env.VLLM_ALLOW_LONG_MAX_MODEL_LEN ?? "");
  out.kvDtype = parseKvDtype(flagValue(flags, "--kv-cache-dtype"));

  const overrides = parseJsonArg("--hf-overrides", flagValue(flags, "--hf-overrides"), out);
  if (overrides) applyOverrideObject(out, overrides);

  // Dedicated flags that existed only up to v0.11.0; the lint decides by version whether they are removed.
  if (hasFlag(flags, "--rope-scaling")) out.removedFlags.push("--rope-scaling");
  if (hasFlag(flags, "--rope-theta")) out.removedFlags.push("--rope-theta");
  const legacy = parseJsonArg("--rope-scaling", flagValue(flags, "--rope-scaling"), out);
  const legacyTheta = parseNumber(flagValue(flags, "--rope-theta"));
  if (legacy || legacyTheta !== undefined) out.legacy = { ropeScaling: legacy, theta: legacyTheta };
  return out;
}

export function legacyTheta(p: ParsedConfig): number | undefined {
  return asNumber(p.legacy?.theta);
}
