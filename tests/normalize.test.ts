import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../src/core/normalize";
import { ConfigShapeError } from "../src/core/types";
import { loadSample } from "../src/samples";
import { readFixture } from "./helpers";

const cfg = (name: string): unknown => JSON.parse(readFixture(`fixtures/configs/${name}`));

describe("normalizeConfig", () => {
  it("qwen3 uses known-model original ctx", () => {
    const m = normalizeConfig(cfg("qwen3-8b.json"));
    expect(m.ropeTheta).toBe(1000000);
    expect(m.maxPositionEmbeddings).toBe(40960);
    expect(m.originalCtx).toBe(32768);
    expect(m.originalCtxSource).toBe("known-model");
    expect(m.existing).toBeNull();
    expect(m.rotaryDim).toBe(128);
    expect(m.kv).toEqual({ layers: 36, kvHeads: 8, headDim: 128, mla: false, sliding: false });
  });

  it("reads legacy rope_scaling and v5 rope_parameters", () => {
    const llama = loadSample("llama-3.2-1b-instruct");
    expect(llama.existing?.type).toBe("llama3");
    expect(llama.existing?.factor).toBe(32);
    expect(llama.originalCtx).toBe(8192);
    expect(llama.originalCtxSource).toBe("config");

    const ds = loadSample("deepseek-v3");
    expect(ds.existing?.type).toBe("yarn");
    expect(ds.existing?.extras).toMatchObject({ mscale: 1, mscale_all_dim: 1, beta_fast: 32, beta_slow: 1 });
    expect(ds.rotaryDim).toBe(64);

    const v5 = normalizeConfig(cfg("v5-yarn.json"));
    expect(v5.existing?.type).toBe("yarn");
    expect(v5.existing?.factor).toBe(4);
    expect(v5.originalCtx).toBe(32768);
    expect(v5.originalCtxSource).toBe("config");
    expect(v5.ropeTheta).toBe(1000000);
  });

  it("per-layer rope parameters", () => {
    const m = normalizeConfig(cfg("per-layer.json"));
    expect(m.existing?.type).toBe("per-layer");
    expect(m.existing?.perLayer).toBe(true);
    expect(m.ropeTheta).toBe(1000000);
  });

  it("applies partial_rotary_factor to the rotary dimension", () => {
    const m = normalizeConfig({ max_position_embeddings: 4096, rope_theta: 10000, head_dim: 128, partial_rotary_factor: 0.5 });
    expect(m.rotaryDim).toBe(64);
  });

  it("throws ConfigShapeError", () => {
    expect(() => normalizeConfig(null)).toThrow(ConfigShapeError);
    expect(() => normalizeConfig({})).toThrow(/max_position_embeddings/);
    expect(() => normalizeConfig({ max_position_embeddings: 4096, head_dim: 64 })).toThrow(/rope_theta/);
    expect(() => normalizeConfig({ max_position_embeddings: 4096, rope_theta: 1e4 })).toThrow(/head_dim/);
  });
});
