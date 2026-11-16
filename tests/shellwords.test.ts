import { describe, expect, it } from "vitest";
import { splitEnv, splitShell } from "../src/core/shellwords";
import { ShellParseError } from "../src/core/types";

describe("shell tokenizer", () => {
  it("keeps single-quoted JSON as one word", () => {
    expect(splitShell(`vllm serve m --hf-overrides '{"a":{"b":1.0}}'`)).toEqual(["vllm", "serve", "m", "--hf-overrides", '{"a":{"b":1.0}}']);
  });

  it("joins backslash line continuations", () => {
    expect(splitShell("llama-server \\\n  -c 4096 \\\n  -m x.gguf")).toEqual(["llama-server", "-c", "4096", "-m", "x.gguf"]);
  });

  it("handles double quotes with escapes and a # comment", () => {
    expect(splitShell(`# note\nrun "a \\"b\\" c" d # trailing`)).toEqual(["run", 'a "b" c', "d"]);
  });

  it("separates leading KEY=VAL environment words", () => {
    const { env, rest } = splitEnv(splitShell("A=1 LLAMA_ARG_CTX_SIZE=8192 llama-server -m x"));
    expect(env).toEqual({ A: "1", LLAMA_ARG_CTX_SIZE: "8192" });
    expect(rest).toEqual(["llama-server", "-m", "x"]);
  });

  it("stops at the first pipe or &&", () => {
    expect(splitShell("a b | c d")).toEqual(["a", "b"]);
    expect(splitShell("a b && c d")).toEqual(["a", "b"]);
  });

  it("reports unclosed quotes", () => {
    expect(() => splitShell("a 'b")).toThrow(ShellParseError);
    expect(() => splitShell('a "b')).toThrow(ShellParseError);
  });
});
