import { describe, expect, it } from "vitest";
import { lintText } from "../src/core/lint";
import { RULE_IDS } from "../src/rules";
import { loadSample } from "../src/samples";
import { listFixtures, readFixture } from "./helpers";

interface Fixture {
  name: string;
  expected: string[];
  model: string;
  version?: string;
  vram?: number;
  body: string;
}

/** Header lines start with "#": "# expect: A, B", "# model: id", "# version: x", "# vram: n". */
function loadFixture(name: string): Fixture {
  const lines = readFixture(`fixtures/commands/${name}`).split("\n");
  const header: Record<string, string> = {};
  let first = true;
  let i = 0;
  for (; i < lines.length && (lines[i] as string).startsWith("#"); i++) {
    const m = /^#\s*(expect|model|version|vram):\s*(.*)$/.exec(lines[i] as string);
    if (first) {
      if (!m || m[1] !== "expect") throw new Error(`${name}: first line must be "# expect: ..."`);
      first = false;
    }
    if (m) header[m[1] as string] = (m[2] as string).trim();
  }
  return {
    name,
    expected: (header.expect ?? "").split(",").map((s) => s.trim()).filter(Boolean).sort(),
    model: header.model ?? "qwen3-8b",
    version: header.version,
    vram: header.vram ? Number(header.vram) : undefined,
    body: lines.slice(i).join("\n"),
  };
}

const fixtures = listFixtures("fixtures/commands").map(loadFixture);

function run(f: Fixture) {
  return lintText(f.body, { model: loadSample(f.model), vllmVersion: f.version, vramGiB: f.vram });
}

describe("lint rules", () => {
  it("has at least 12 fixtures and covers all 12 rules", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(12);
    const covered = new Set(fixtures.flatMap((f) => f.expected));
    expect([...covered].sort()).toEqual([...RULE_IDS].sort());
    expect(RULE_IDS).toHaveLength(12);
  });

  it("each command fixture yields exactly its expected rule ids", () => {
    for (const f of fixtures) {
      const ids = run(f).findings.map((x) => x.ruleId).sort();
      expect({ file: f.name, ids }).toEqual({ file: f.name, ids: f.expected });
    }
  });

  it("correct commands have no findings", () => {
    const correct = fixtures.filter((f) => f.name.startsWith("correct-"));
    expect(correct.length).toBeGreaterThanOrEqual(5);
    for (const f of correct) {
      const res = run(f);
      expect({ file: f.name, parsed: res.parsed.engine !== "unknown", findings: res.findings }).toEqual({ file: f.name, parsed: true, findings: [] });
    }
  });

  it("double scaling is modelled as replacement, not multiplication", () => {
    const f = fixtures.find((x) => x.name === "vllm-replaces-author.txt") as Fixture;
    const finding = run(f).findings[0];
    expect(finding?.ruleId).toBe("REPLACES_AUTHOR_VALUES");
    expect(String(finding?.params.lost)).toContain("mscale");
    // the effective capacity is the override's own factor x original length; no product with the author's factor
    expect(run(f).findings.map((x) => x.ruleId)).not.toContain("FACTOR_TOO_SMALL");
  });

  it("offers a corrected command that passes lint", () => {
    const f = fixtures.find((x) => x.name === "vllm-fixed-flag-still-wrong.txt") as Fixture;
    const finding = run(f).findings.find((x) => x.ruleId === "THETA_MISSING");
    expect(finding?.fix).toContain('"rope_theta":1000000');
    const again = lintText(finding?.fix ?? "", { model: loadSample("qwen3-8b"), vllmVersion: f.version });
    expect(again.findings).toEqual([]);
  });

  it("every finding carries an https source, a basis and a severity", () => {
    for (const f of fixtures) {
      for (const x of run(f).findings) {
        expect(x.sourceUrl).toMatch(/^https:\/\//);
        expect(["source", "docs"]).toContain(x.basis);
        expect(["error", "warning", "info"]).toContain(x.severity);
      }
    }
  });

  it("vLLM version bands change which rules apply", () => {
    const body = readFixture("fixtures/commands/vllm-removed-flag.txt");
    const model = loadSample("qwen3-8b");
    expect(lintText(body, { model, vllmVersion: "0.11.0" }).findings.map((x) => x.ruleId)).toEqual([]);
    expect(lintText(body, { model, vllmVersion: "0.11.1" }).findings.map((x) => x.ruleId)).toEqual(["VLLM_REMOVED_FLAG"]);
    expect(lintText(body, { model, vllmVersion: "0.99" }).beyondChecked).toBe(true);
  });

  it("NO_SCALING_LONG_CTX fires only for long, unscaled, non-native requests", () => {
    const model = loadSample("qwen3-8b");
    const long = (cmd: string, m = model) => lintText(cmd, { model: m, vllmVersion: "0.32" }).findings.filter((x) => x.ruleId === "NO_SCALING_LONG_CTX");
    expect(long("llama-server -m q.gguf -c 131072")).toHaveLength(1);
    expect(long("python -m sglang.launch_server --model-path Qwen/Qwen3-8B --context-length 131072")[0]?.severity).toBe("warning");
    expect(long("vllm serve Qwen/Qwen3-8B --max-model-len 131072")[0]?.fix).toContain("--hf-overrides");
    expect(long("vllm serve Qwen/Qwen3-8B --max-model-len 32768")).toEqual([]);
    expect(long("vllm serve Qwen/Qwen3-8B --max-model-len 131072 --hf-overrides '{\"rope_parameters\":{\"rope_type\":\"yarn\",\"factor\":4.0,\"original_max_position_embeddings\":32768,\"rope_theta\":1000000}}'")).toEqual([]);
    const ollama = long("FROM qwen3:8b\nPARAMETER num_ctx 131072");
    expect(ollama).toHaveLength(1);
    expect(ollama[0]?.fix).toBeUndefined();
    expect(long("vllm serve m --max-model-len 131072", loadSample("llama-3.2-1b-instruct"))).toEqual([]);
  });

  it("NO_SCALING_LONG_CTX is skipped only when another rule already reported the ignored scaling", () => {
    const model = loadSample("qwen3-8b");
    const ids = (cmd: string, v?: string) => lintText(cmd, { model, vllmVersion: v }).findings.map((x) => x.ruleId);
    expect(ids("vllm serve Qwen/Qwen3-8B --rope-scaling '{\"rope_type\":\"yarn\",\"factor\":4}' --max-model-len 131072", "0.32")).toEqual(["VLLM_REMOVED_FLAG"]);
    expect(ids("FROM qwen3:8b\nPARAMETER num_ctx 131072\nPARAMETER rope_frequency_base 1000000")).toEqual(["OLLAMA_NO_RUNTIME_ROPE"]);
    expect(ids("vllm serve Qwen/Qwen3-8B --rope-theta 1000000 --max-model-len 131072", "0.10.2")).toEqual(["NO_SCALING_LONG_CTX"]);
  });

  it("an assumed original length lowers NO_SCALING_LONG_CTX to info", () => {
    const model = { ...loadSample("qwen3-8b"), originalCtxSource: "max_position_embeddings" as const };
    const f = lintText("llama-server -m q.gguf -c 131072", { model }).findings.find((x) => x.ruleId === "NO_SCALING_LONG_CTX");
    expect(f?.severity).toBe("info");
    expect(f?.params.estimated).toBe(1);
  });

  it("unknown engines and broken quoting are reported, not thrown", () => {
    expect(lintText("echo hello", { model: null }).parsed.engine).toBe("unknown");
    expect(lintText("llama-server -m 'x", { model: null }).parsed.errors[0]).toMatch(/quote/);
    expect(lintText("vllm serve m --hf-overrides '{bad'", { model: null }).parsed.errors[0]).toMatch(/JSON/);
  });
});
