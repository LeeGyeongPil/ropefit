import { describe, expect, it } from "vitest";
import { estimateKv } from "../src/core/kv";
import { lintParsed } from "../src/core/lint";
import { parseCommand } from "../src/core/parse";
import { loadSample } from "../src/samples";

describe("kv cache estimate", () => {
  it("qwen3-8b bf16 kv cache", () => {
    const m = loadSample("qwen3-8b");
    expect(estimateKv(m, 32768, "bf16").gib.toFixed(2)).toBe("4.50");
    expect(estimateKv(m, 131072, "bf16").gib.toFixed(2)).toBe("18.00");
    expect(estimateKv(m, 131072, "fp8").gib.toFixed(2)).toBe("9.00");
  });

  it("mla models are not estimated", () => {
    const e = estimateKv(loadSample("deepseek-v3"), 131072, "bf16");
    expect(e.supported).toBe(false);
    expect(e.reason).toBe("mla");
  });

  it("sliding-window models are not estimated", () => {
    expect(estimateKv(loadSample("layered-example"), 8192, "bf16").reason).toBe("sliding");
  });

  it("KV_EXCEEDS_VRAM fires at 131072 with 16 GiB but not with 24 GiB", () => {
    const cmd = "llama-server -m x.gguf -c 131072 --rope-scaling yarn --rope-scale 4 --yarn-orig-ctx 32768";
    const model = loadSample("qwen3-8b");
    const hit = lintParsed(parseCommand(cmd), { model, vramGiB: 16 }).map((f) => f.ruleId);
    expect(hit).toContain("KV_EXCEEDS_VRAM");
    expect(lintParsed(parseCommand(cmd), { model, vramGiB: 24 }).map((f) => f.ruleId)).not.toContain("KV_EXCEEDS_VRAM");
  });
});
