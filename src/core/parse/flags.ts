// Generic "--flag value" / "--flag=value" / "-c value" argument reader shared by the engine parsers.
import type { KvDtype } from "../types";
import { asNumber, isRecord } from "../util";
import type { ParsedConfig } from "./types";

export type FlagMap = Map<string, string | true>;

export function parseFlags(words: string[]): { flags: FlagMap; positionals: string[] } {
  const flags: FlagMap = new Map();
  const positionals: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i] as string;
    if (w.startsWith("--") && w.includes("=")) {
      const eq = w.indexOf("=");
      flags.set(w.slice(0, eq), w.slice(eq + 1));
    } else if (w.startsWith("-") && w.length > 1 && !/^-\d/.test(w)) {
      const next = words[i + 1];
      if (next !== undefined && (!next.startsWith("-") || /^-\d/.test(next))) {
        flags.set(w, next);
        i += 1;
      } else {
        flags.set(w, true);
      }
    } else {
      positionals.push(w);
    }
  }
  return { flags, positionals };
}

export function flagValue(flags: FlagMap, ...names: string[]): string | undefined {
  for (const n of names) {
    const v = flags.get(n);
    if (typeof v === "string") return v;
  }
  return undefined;
}

export function hasFlag(flags: FlagMap, ...names: string[]): boolean {
  return names.some((n) => flags.has(n));
}

/** "131072", "128k", "1m" -> tokens. Returns undefined for anything else or 0. */
export function parseLength(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const m = /^(\d+(?:\.\d+)?)([kKmM]?)$/.exec(v.trim());
  if (!m) return undefined;
  const mult = m[2]?.toLowerCase() === "k" ? 1024 : m[2]?.toLowerCase() === "m" ? 1024 * 1024 : 1;
  const n = Math.round(Number(m[1]) * mult);
  return n > 0 ? n : undefined;
}

export function parseNumber(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function parseKvDtype(v: string | undefined): KvDtype | undefined {
  switch (v?.toLowerCase()) {
    case "f32": return "f32";
    case "bf16": return "bf16";
    case "f16": case "fp16": case "half": return "fp16";
    case "fp8": case "fp8_e4m3": case "fp8_e5m2": return "fp8";
    case "q8_0": return "q8_0";
    case "q4_0": return "q4_0";
    default: return undefined;
  }
}

/** Parse a JSON object argument; on failure records an error message and returns undefined. */
export function parseJsonArg(flag: string, text: string | undefined, out: ParsedConfig): Record<string, unknown> | undefined {
  if (text === undefined) return undefined;
  try {
    const v: unknown = JSON.parse(text);
    if (isRecord(v)) return v;
    out.errors.push(`${flag}: expected a JSON object`);
    out.errorInfo.push({ code: "not-object", params: { flag } });
  } catch {
    out.errors.push(`${flag}: value is not valid JSON (check the quotes around it)`);
    out.errorInfo.push({ code: "bad-json", params: { flag } });
  }
  return undefined;
}

/** Fill override + scaling fields from a JSON object that carries rope_parameters / rope_scaling. */
export function applyOverrideObject(parsed: ParsedConfig, obj: Record<string, unknown>): void {
  const rp = isRecord(obj.rope_parameters) ? obj.rope_parameters : undefined;
  const rs = isRecord(obj.rope_scaling) ? obj.rope_scaling : undefined;
  const dict = rp ?? rs;
  const maxPos = asNumber(obj.max_position_embeddings);
  const topTheta = asNumber(obj.rope_theta);
  if (dict) {
    parsed.override = {
      key: rp ? "rope_parameters" : "rope_scaling",
      dict,
      maxPositionEmbeddings: maxPos,
      topLevelTheta: topTheta,
    };
    parsed.scaling = scalingFromDict(dict, topTheta);
  } else if (maxPos !== undefined || topTheta !== undefined) {
    parsed.override = undefined;
  }
}

export function scalingFromDict(dict: Record<string, unknown>, topTheta?: number): NonNullable<ParsedConfig["scaling"]> {
  const type = String(dict.rope_type ?? dict.type ?? "").toLowerCase();
  return {
    type: type || undefined,
    typeExplicit: type !== "",
    factor: asNumber(dict.factor),
    origCtx: asNumber(dict.original_max_position_embeddings),
    theta: asNumber(dict.rope_theta) ?? topTheta,
  };
}
