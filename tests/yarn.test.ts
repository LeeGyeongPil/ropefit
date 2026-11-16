import { describe, expect, it } from "vitest";
import { defaultInvFreq, linearInvFreq, yarnInvFreq } from "../src/core/yarn";
import { readFixture } from "./helpers";

const ref = JSON.parse(readFixture("fixtures/tf-yarn-qwen3.json")) as { inv_freq: number[]; attn: number };

describe("yarn math", () => {
  it("matches transformers yarn reference for Qwen3 x4", () => {
    const r = yarnInvFreq({ base: 1e6, dim: 128, factor: 4, originalCtx: 32768 });
    expect(r.invFreq).toHaveLength(64);
    let maxRel = 0;
    r.invFreq.forEach((v, i) => {
      maxRel = Math.max(maxRel, Math.abs(v - (ref.inv_freq[i] as number)) / (ref.inv_freq[i] as number));
    });
    expect(maxRel).toBeLessThan(1e-6);
    expect(Math.abs(r.attentionFactor - ref.attn)).toBeLessThan(1e-12);
    expect(r.attentionFactor).toBeCloseTo(1.138629436111989, 12);
    expect([r.rampLow, r.rampHigh]).toEqual([23, 40]);
  });

  it("linear divides every frequency by factor", () => {
    const base = defaultInvFreq(1e6, 128);
    const lin = linearInvFreq(1e6, 128, 4);
    lin.forEach((v, i) => expect(v).toBeCloseTo((base[i] as number) / 4, 15));
  });

  it("yarn keeps high-frequency dimensions and stretches low-frequency ones", () => {
    const base = defaultInvFreq(1e6, 128);
    const r = yarnInvFreq({ base: 1e6, dim: 128, factor: 4, originalCtx: 32768 });
    expect(r.invFreq[0]).toBe(base[0]);
    expect(r.invFreq[63]).toBeCloseTo((base[63] as number) / 4, 15);
  });

  it("factor 1 changes nothing and has attention factor 1", () => {
    const r = yarnInvFreq({ base: 1e4, dim: 64, factor: 1, originalCtx: 4096 });
    expect(r.attentionFactor).toBe(1);
    r.invFreq.forEach((v, i) => expect(v).toBeCloseTo(defaultInvFreq(1e4, 64)[i] as number, 15));
  });
});
