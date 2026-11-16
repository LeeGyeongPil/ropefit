import { parseLength } from "./flags";
import { emptyParsed } from "./types";
import type { ParsedConfig } from "./types";

const ROPE_PARAMS = new Set(["rope_frequency_base", "rope_frequency_scale"]);

/** Modelfile text: FROM ..., PARAMETER name value. Also accepts "/set parameter name value". */
export function parseOllamaModelfile(text: string): ParsedConfig {
  const out = emptyParsed("ollama");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const from = /^FROM\s+(\S+)/i.exec(line);
    if (from) { out.model = from[1]; continue; }
    const param = /^(?:\/set\s+parameter|PARAMETER)\s+(\w+)\s+(.+)$/i.exec(line);
    if (!param) continue;
    const name = (param[1] as string).toLowerCase();
    if (name === "num_ctx") out.ctx = parseLength((param[2] as string).trim());
    if (ROPE_PARAMS.has(name) && !out.ollamaRopeParams.includes(name)) out.ollamaRopeParams.push(name);
  }
  return out;
}
