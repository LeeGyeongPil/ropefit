import { describe, expect, it } from "vitest";
import { generate } from "../src/core/generate";
import { lintText } from "../src/core/lint";
import { planScale } from "../src/core/plan";
import type { EngineId } from "../src/core/types";
import { VLLM_BANDS, BAND_VERSION } from "../src/rules";
import type { VllmBandId } from "../src/rules";
import { SAMPLES, loadSample } from "../src/samples";

// Ollama is guidance, not a command, so it is excluded from the round trip.
const ENGINES: EngineId[] = ["llamacpp", "vllm", "sglang", "transformers"];
const TARGETS = [32768, 40960, 65536, 131072];

describe("round trip", () => {
  it("generated configs pass lint for every sample/engine/band", () => {
    let checked = 0;
    for (const s of SAMPLES) {
      const model = loadSample(s.id);
      for (const target of TARGETS) {
        const plan = planScale(model, target);
        for (const engine of ENGINES) {
          const bands: (VllmBandId | undefined)[] = engine === "vllm" ? VLLM_BANDS.map((b) => b.id) : [undefined];
          for (const band of bands) {
            const out = generate(engine, { model, plan, modelName: s.name, vllmBand: band });
            const block = engine === "transformers" ? out.blocks.find((b) => b.kind === "json") : out.blocks[0];
            const res = lintText(block?.text ?? "", { model, vllmVersion: band ? BAND_VERSION[band] : undefined });
            const bad = res.findings.filter((f) => f.severity !== "info").map((f) => f.ruleId);
            expect({ sample: s.id, target, engine, band, recognized: res.parsed.engine === engine, errors: res.parsed.errors, bad }).toEqual({
              sample: s.id, target, engine, band, recognized: true, errors: [], bad: [],
            });
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(SAMPLES.length * TARGETS.length * (3 + VLLM_BANDS.length));
  });

  it("the generated env-var block is understood too", () => {
    const model = loadSample("qwen3-8b");
    const plan = planScale(model, 131072);
    const out = generate("llamacpp", { model, plan, modelName: "x" });
    const env = (out.blocks[1]?.text ?? "").split("\n").join(" ");
    const res = lintText(`${env} llama-server -m x.gguf`, { model });
    expect(res.parsed.ctx).toBe(131072);
    expect(res.parsed.scaling?.factor).toBe(4);
    expect(res.findings).toEqual([]);
  });
});
