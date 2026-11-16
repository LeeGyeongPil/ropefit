import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generate, renderText } from "../src/core/generate";
import { planScale } from "../src/core/plan";
import type { EngineId } from "../src/core/types";
import type { VllmBandId } from "../src/rules";
import { loadSample } from "../src/samples";
import { fixturePath } from "./helpers";

const model = loadSample("qwen3-8b");
const name = "Qwen/Qwen3-8B";

const cases: { file: string; engine: EngineId; band?: VllmBandId }[] = [
  { file: "llamacpp", engine: "llamacpp" },
  { file: "vllm-le-0.11.0", engine: "vllm", band: "le-0.11.0" },
  { file: "vllm-0.11.1", engine: "vllm", band: "0.11.1" },
  { file: "vllm-0.12-0.29", engine: "vllm", band: "0.12-0.29" },
  { file: "vllm-ge-0.30", engine: "vllm", band: "ge-0.30" },
  { file: "sglang", engine: "sglang" },
  { file: "transformers", engine: "transformers" },
  { file: "ollama", engine: "ollama" },
];

describe("generators", () => {
  const plan = planScale(model, 131072);

  it("plans Qwen3-8B x4 from the known original length", () => {
    expect(plan).toMatchObject({ kind: "yarn", factor: 4, originalCtx: 32768, targetCtx: 131072 });
  });

  for (const c of cases) {
    it(`golden: ${c.file}`, () => {
      const out = renderText(generate(c.engine, { model, plan, modelName: name, vllmBand: c.band }));
      const path = fixturePath(`golden/qwen3-8b-131072.${c.file}.txt`);
      if (process.env.UPDATE_GOLDEN === "1" && !existsSync(path)) writeFileSync(path, out);
      expect(out).toBe(readFileSync(path, "utf8"));
    });
  }

  it("llama.cpp flags and env vars carry the same settings", () => {
    const out = generate("llamacpp", { model, plan, modelName: name });
    expect(out.blocks[0]?.text).toContain("-c 131072 --rope-scaling yarn --rope-scale 4 --yarn-orig-ctx 32768");
    expect(out.blocks[1]?.text).toContain("LLAMA_ARG_ROPE_SCALING_TYPE=yarn");
  });

  it("every vLLM band uses its own syntax", () => {
    const texts = (["le-0.11.0", "0.11.1", "0.12-0.29", "ge-0.30"] as VllmBandId[]).map(
      (b) => generate("vllm", { model, plan, modelName: name, vllmBand: b }).blocks[0]?.text ?? "",
    );
    expect(texts[0]).toContain("--rope-scaling");
    expect(texts[0]).toContain("--rope-theta 1000000");
    expect(texts[1]).toContain('"rope_scaling"');
    expect(texts[1]).not.toContain("--rope-scaling");
    expect(texts[2]).toContain('"rope_parameters"');
    expect(texts[2]).toContain('"rope_theta":1000000');
    expect(texts[2]).not.toContain('"max_position_embeddings"');
    expect(texts[3]).toContain('"max_position_embeddings":131072');
    expect(new Set(texts).size).toBe(4);
    expect(generate("vllm", { model, plan, modelName: name, vllmBand: "ge-0.30" }).notes).toContain("vllm-v030-source-based");
  });

  it("sglang and transformers include theta", () => {
    expect(generate("sglang", { model, plan, modelName: name }).blocks[0]?.text).toContain('"rope_theta":1000000');
    expect(generate("transformers", { model, plan, modelName: name }).blocks.map((b) => b.text).join("\n")).toContain("rope_theta");
  });

  it("ollama gives guidance with no runtime flag", () => {
    const out = generate("ollama", { model, plan, modelName: name });
    expect(out.blocks[0]?.kind).toBe("note");
    expect(out.blocks.some((b) => b.text.includes("--rope"))).toBe(true); // only in the llama.cpp alternative
    expect(out.blocks.filter((b) => b.kind === "modelfile").every((b) => !/rope/i.test(b.text))).toBe(true);
    expect(out.notes).toContain("ollama-num-ctx-window-only");
  });

  it("factor for 65536 is 2", () => {
    const p = planScale(model, 65536);
    expect(p.factor).toBe(2);
    expect(generate("llamacpp", { model, plan: p, modelName: name }).blocks[0]?.text).toContain("--rope-scale 2 ");
  });

  it("no scaling at or below original ctx", () => {
    const p = planScale(model, 32768);
    expect(p.kind).toBe("none");
    const out = generate("llamacpp", { model, plan: p, modelName: name });
    expect(out.blocks[0]?.text).toBe("llama-server -m <model.gguf> -c 32768");
    expect(out.notes).toContain("no-scaling-needed");
    expect(planScale(model, 16000).kind).toBe("none");
  });

  it("keeps model-own schemes and covering YaRN instead of overriding", () => {
    expect(planScale(loadSample("llama-3.2-1b-instruct"), 65536).kind).toBe("native-keep");
    expect(planScale(loadSample("deepseek-v3"), 131072).kind).toBe("native-keep");
    expect(planScale(loadSample("layered-example"), 65536).kind).toBe("native-keep");
  });

  it("keeps author YaRN extras when a bigger factor is needed", () => {
    const ds = loadSample("deepseek-v3");
    const p = planScale(ds, 327680);
    expect(p.kind).toBe("yarn");
    expect(p.factor).toBe(80);
    const text = generate("vllm", { model: ds, plan: p, modelName: "deepseek-ai/DeepSeek-V3", vllmBand: "0.12-0.29" }).blocks[0]?.text ?? "";
    expect(text).toContain('"mscale":1');
    expect(text).toContain('"beta_fast":32');
  });
});
