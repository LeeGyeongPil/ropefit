import { flagValue, parseFlags, parseKvDtype, parseLength, parseNumber } from "./flags";
import { emptyParsed } from "./types";
import type { ParsedConfig } from "./types";

/** words = arguments after the program name; env = leading KEY=VAL words. CLI flags beat LLAMA_ARG_* variables. */
export function parseLlamaCpp(words: string[], env: Record<string, string>): ParsedConfig {
  const out = emptyParsed("llamacpp");
  const { flags } = parseFlags(words);
  const pick = (names: string[], envName: string) => flagValue(flags, ...names) ?? env[envName];

  out.model = pick(["-m", "--model"], "LLAMA_ARG_MODEL");
  const ctx = parseLength(pick(["-c", "--ctx-size"], "LLAMA_ARG_CTX_SIZE"));
  out.ctx = ctx;

  const typeRaw = pick(["--rope-scaling"], "LLAMA_ARG_ROPE_SCALING_TYPE");
  const scale = parseNumber(pick(["--rope-scale"], "LLAMA_ARG_ROPE_SCALE"));
  const freqScale = parseNumber(pick(["--rope-freq-scale"], "LLAMA_ARG_ROPE_FREQ_SCALE"));
  const origCtx = parseNumber(pick(["--yarn-orig-ctx"], "LLAMA_ARG_YARN_ORIG_CTX"));
  const theta = parseNumber(pick(["--rope-freq-base"], "LLAMA_ARG_ROPE_FREQ_BASE"));
  const factor = scale ?? (freqScale && freqScale > 0 ? 1 / freqScale : undefined);

  if (typeRaw !== undefined || factor !== undefined || origCtx !== undefined || theta !== undefined) {
    out.scaling = { type: typeRaw?.toLowerCase(), typeExplicit: typeRaw !== undefined, factor, origCtx, theta };
  }
  out.kvDtype = parseKvDtype(pick(["-ctk", "--cache-type-k"], "LLAMA_ARG_CACHE_TYPE_K"));
  return out;
}
