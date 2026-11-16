import { asNumber, isRecord } from "../util";
import { applyOverrideObject } from "./flags";
import { emptyParsed } from "./types";
import type { ParsedConfig } from "./types";

/** A config.json fragment: {"rope_parameters": {...}, "max_position_embeddings": N}. */
export function parseTransformersJson(text: string): ParsedConfig {
  const out = emptyParsed("transformers");
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    out.errors.push("config fragment is not valid JSON");
    out.errorInfo.push({ code: "fragment-bad-json", params: {} });
    return out;
  }
  if (!isRecord(obj)) {
    out.errors.push("config fragment must be a JSON object");
    out.errorInfo.push({ code: "fragment-not-object", params: {} });
    return out;
  }
  out.ctx = asNumber(obj.max_position_embeddings);
  applyOverrideObject(out, obj);
  return out;
}
