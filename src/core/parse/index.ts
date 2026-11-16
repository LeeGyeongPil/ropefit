// Detect which engine a pasted text is for and parse it into a ParsedConfig.
import { splitEnv, splitShell } from "../shellwords";
import { ShellParseError } from "../types";
import type { EngineId } from "../types";
import { parseLlamaCpp } from "./llamacpp";
import { parseOllamaModelfile } from "./ollama";
import { parseSglang } from "./sglang";
import { parseTransformersJson } from "./transformers";
import { emptyParsed } from "./types";
import type { ParsedConfig } from "./types";
import { parseVllm } from "./vllm";

export type { ParsedConfig } from "./types";

function basename(p: string): string {
  return p.slice(p.lastIndexOf("/") + 1);
}

export function parseCommand(text: string, forced?: EngineId): ParsedConfig {
  const trimmed = text.trim();
  if (trimmed === "") return emptyParsed("unknown");
  if (forced === "transformers" || (!forced && trimmed.startsWith("{"))) return parseTransformersJson(trimmed);
  if (forced === "ollama" || (!forced && /^\s*(FROM|PARAMETER)\s/im.test(trimmed))) return parseOllamaModelfile(trimmed);

  let words: string[];
  try {
    words = splitShell(trimmed);
  } catch (err) {
    const p = emptyParsed("unknown");
    p.errors.push((err as Error).message);
    p.errorInfo.push({ code: err instanceof ShellParseError ? err.code : "generic", params: {} });
    return p;
  }
  const { env, rest } = splitEnv(words);
  const prog = rest[0] ? basename(rest[0]) : "";
  const joined = rest.join(" ");

  const vllmAt = rest.findIndex((w) => w.includes("vllm.entrypoints"));
  const isVllm = prog === "vllm" || vllmAt >= 0;
  const isSglang = rest.some((w) => w.includes("sglang.launch_server")) || prog === "sglang";
  const isLlama = /^llama-/.test(prog) || prog === "llama.cpp";

  const engine: EngineId | "unknown" = forced ?? (isVllm ? "vllm" : isSglang ? "sglang" : isLlama ? "llamacpp" : joined.includes("ollama") ? "ollama" : "unknown");
  switch (engine) {
    case "vllm": {
      const start = vllmAt >= 0 ? vllmAt + 1 : rest[1] === "serve" ? 2 : 1;
      return parseVllm(rest.slice(start), env);
    }
    case "sglang": {
      const at = rest.findIndex((w) => w.includes("sglang.launch_server"));
      return parseSglang(rest.slice(at >= 0 ? at + 1 : 1));
    }
    case "llamacpp":
      return parseLlamaCpp(rest.slice(1), env);
    case "ollama":
      return parseOllamaModelfile(trimmed);
    default: {
      const p = emptyParsed("unknown");
      p.errors.push("engine not recognized: start the command with llama-server, vllm serve or python -m sglang.launch_server");
      p.errorInfo.push({ code: "unrecognized", params: {} });
      return p;
    }
  }
}
