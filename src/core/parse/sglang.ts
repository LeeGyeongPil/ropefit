import { applyOverrideObject, flagValue, parseFlags, parseJsonArg, parseLength } from "./flags";
import { emptyParsed } from "./types";
import type { ParsedConfig } from "./types";

export function parseSglang(words: string[]): ParsedConfig {
  const out = emptyParsed("sglang");
  const { flags } = parseFlags(words);
  out.model = flagValue(flags, "--model-path", "--model");
  out.ctx = parseLength(flagValue(flags, "--context-length"));
  const overrides = parseJsonArg("--json-model-override-args", flagValue(flags, "--json-model-override-args"), out);
  if (overrides) applyOverrideObject(out, overrides);
  return out;
}
