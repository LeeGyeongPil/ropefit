import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "../src/App";
import { LANG_STORAGE_KEY, MESSAGES } from "../src/i18n";
import { lintText } from "../src/core/lint";
import { loadSample } from "../src/samples";

// Core errors are English for library use; the UI must show them in the chosen language.
const ENGLISH_ONLY = /missing|not recognized|not valid JSON|Unclosed|Paste|Unsupported|must be|expected a/i;

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(LANG_STORAGE_KEY, "ko");
});
afterEach(cleanup);

describe("error messages follow the UI language", () => {
  it("paste errors are Korean", () => {
    render(<App />);
    const box = screen.getByLabelText("또는 config.json 붙여넣기", { selector: "textarea" });
    for (const text of ['{"hidden_size":4096}', "[1]", "{bad"]) {
      fireEvent.change(box, { target: { value: text } });
      fireEvent.click(screen.getByRole("button", { name: "붙여넣은 설정 사용" }));
      const alert = screen.getByRole("alert").textContent ?? "";
      expect(alert, text).toMatch(/[가-힣]/);
      expect(alert, text).not.toMatch(ENGLISH_ONLY);
    }
  });

  it("check-tab parse errors are Korean", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "검사" }));
    const box = screen.getByLabelText("기존 명령·설정 검사");
    for (const text of ["docker run foo", "llama-server -m 'x", "vllm serve m --hf-overrides '{bad'", "{bad"]) {
      fireEvent.change(box, { target: { value: text } });
      const alerts = screen.getAllByRole("alert").map((a) => a.textContent ?? "");
      for (const a of alerts) {
        expect(a, text).toMatch(/[가-힣]/);
        expect(a, text).not.toMatch(ENGLISH_ONLY);
      }
    }
  });

  it("sample suffix and pasted name are translated", () => {
    render(<App />);
    expect(screen.getByRole("option", { name: /\(합성\)/ })).toBeTruthy();
    expect(screen.queryByText(/\(synthetic\)/)).toBeNull();
  });

  it("every error code produced by the core has a message in both languages", () => {
    const codes = ["unrecognized", "bad-json", "not-object", "fragment-bad-json", "fragment-not-object", "unclosed-single", "unclosed-double"];
    for (const c of codes) for (const lang of ["en", "ko"] as const) expect(MESSAGES[lang][`error.parse.${c}`], `${lang} ${c}`).toBeTruthy();
    for (const c of ["missing-key", "not-object", "no-theta", "no-head-dim", "no-context"]) {
      expect(MESSAGES.ko[`error.config.${c}`], c).toBeTruthy();
    }
    for (const c of ["truncated", "huge-number", "long-string", "unknown-type", "too-small", "bad-magic", "bad-version", "too-many", "array-type", "no-arch"]) {
      expect(MESSAGES.ko[`error.gguf.${c}`], c).toBeTruthy();
    }
  });
});

describe("llama.cpp fix keeps the user's model path", () => {
  it("copies -m into the suggested command", () => {
    const model = loadSample("qwen3-8b");
    const res = lintText("llama-server -m /models/my-model.Q4.gguf -c 131072 --rope-scale 4", { model });
    const fix = res.findings.find((f) => f.ruleId === "LINEAR_TRAP")?.fix ?? "";
    expect(fix).toContain("/models/my-model.Q4.gguf");
    expect(fix).not.toContain("<model.gguf>");
  });

  it("falls back to the placeholder without -m", () => {
    const model = loadSample("qwen3-8b");
    const res = lintText("llama-server -c 131072 --rope-scale 4", { model });
    expect(res.findings.find((f) => f.ruleId === "LINEAR_TRAP")?.fix ?? "").toContain("<model.gguf>");
  });
});
