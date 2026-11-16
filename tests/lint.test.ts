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
  it("has at least 12 fixtures and covers all 11 rules", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(12);
    const covered = new Set(fixtures.flatMap((f) => f.expected));
    expect([...covered].sort()).toEqual([...RULE_IDS].sort());
    expect(RULE_IDS).toHaveLength(11);
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
        expect(["error", "warning"]).toContain(x.severity);
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

  it("unknown engines and broken quoting are reported, not thrown", () => {
    expect(lintText("echo hello", { model: null }).parsed.engine).toBe("unknown");
    expect(lintText("llama-server -m 'x", { model: null }).parsed.errors[0]).toMatch(/quote/);
    expect(lintText("vllm serve m --hf-overrides '{bad'", { model: null }).parsed.errors[0]).toMatch(/JSON/);
  });
});
