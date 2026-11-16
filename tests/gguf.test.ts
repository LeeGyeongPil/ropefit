// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ggufRope, modelFromGguf, readGgufFile, readGgufHeader } from "../src/core/gguf";
import type { ByteSource } from "../src/core/gguf";
import { GgufParseError } from "../src/core/types";
import { fixturePath } from "./helpers";
import { readFileSync } from "node:fs";

const load = (name: string) => new Blob([readFileSync(fixturePath(`fixtures/gguf/${name}`))]);

describe("gguf header parser", () => {
  it("reads rope keys from tiny-rope.gguf", async () => {
    const info = await readGgufFile(load("tiny-rope.gguf"));
    expect(info.arch).toBe("qwen3");
    expect(ggufRope(info)).toEqual({
      arch: "qwen3",
      contextLength: 40960,
      freqBase: 1000000,
      scalingType: "yarn",
      scalingFactor: 2,
      originalContextLength: 32768,
    });
    const model = modelFromGguf(info);
    expect(model.originalCtx).toBe(32768);
    expect(model.originalCtxSource).toBe("gguf");
    expect(model.existing?.type).toBe("yarn");
  });

  it("plain gguf has no scaling keys", async () => {
    const info = await readGgufFile(load("tiny-plain.gguf"));
    const rope = ggufRope(info);
    expect(rope.scalingType).toBeUndefined();
    expect(rope.scalingFactor).toBeUndefined();
    const model = modelFromGguf(info);
    expect(model.existing).toBeNull();
    expect(model.notes).toContain("gguf-no-scaling-keys");
    // known-model table supplies the original length for qwen3
    expect(model.originalCtx).toBe(32768);
    expect(model.originalCtxSource).toBe("known-model");
  });

  it("rejects truncated or non-gguf input", async () => {
    const full = readFileSync(fixturePath("fixtures/gguf/tiny-rope.gguf"));
    await expect(readGgufFile(new Blob([full.subarray(0, 100)]))).rejects.toThrow(GgufParseError);
    await expect(readGgufFile(new Blob([new TextEncoder().encode("not a gguf file at all, just text.......")]))).rejects.toThrow(/GGUF/);
    await expect(readGgufFile(new Blob([]))).rejects.toThrow(GgufParseError);
  });

  it("does not read tensor data (stops inside the first window)", async () => {
    const full = readFileSync(fixturePath("fixtures/gguf/tiny-rope.gguf"));
    const padded = new Uint8Array(full.length + 4 * 1024 * 1024);
    padded.set(full);
    const requested: number[] = [];
    const src: ByteSource = {
      size: padded.length,
      slice: (s, e) => {
        requested.push(e);
        return { arrayBuffer: async () => padded.slice(s, e).buffer };
      },
    };
    const info = await readGgufHeader(src);
    expect(info.arch).toBe("qwen3");
    expect(Math.max(...requested)).toBeLessThanOrEqual(256 * 1024);
    expect(info.bytesRead).toBeLessThan(padded.length / 8);
  });
});
