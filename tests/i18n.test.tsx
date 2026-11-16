import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "../src/App";
import { LANG_STORAGE_KEY, MESSAGES, translate } from "../src/i18n";
import { RULE_IDS } from "../src/rules";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function setNavigatorLanguage(lang: string) {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(lang);
}

beforeEach(() => {
  window.localStorage.clear();
  setNavigatorLanguage("en-US");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("i18n tables", () => {
  it("en and ko have identical keys", () => {
    const en = Object.keys(MESSAGES.en).sort();
    const ko = Object.keys(MESSAGES.ko).sort();
    expect(ko).toEqual(en);
    for (const k of en) {
      expect(MESSAGES.en[k]?.trim(), `en ${k}`).toBeTruthy();
      expect(MESSAGES.ko[k]?.trim(), `ko ${k}`).toBeTruthy();
      expect(placeholders(MESSAGES.ko[k] as string), `placeholders of ${k}`).toEqual(placeholders(MESSAGES.en[k] as string));
    }
  });

  it("every rule id has both translations", () => {
    for (const id of RULE_IDS) {
      for (const lang of ["en", "ko"] as const) {
        expect(MESSAGES[lang][`rule.${id}.title`], `${lang} ${id} title`).toBeTruthy();
        expect(MESSAGES[lang][`rule.${id}.body`], `${lang} ${id} body`).toBeTruthy();
      }
    }
  });

  it("every note code, block label, engine and band has both translations", () => {
    const keys = Object.keys(MESSAGES.en);
    for (const prefix of ["note.", "block.", "engine.", "vllm.band.", "kv.unsupported.", "error.hf."]) {
      expect(keys.filter((k) => k.startsWith(prefix)).length).toBeGreaterThan(0);
    }
  });

  it("translate substitutes params and falls back to the key", () => {
    expect(translate("ko", "plan.yarn", { factor: 4, target: 131072, orig: 32768 })).toBe("YaRN 배율 4 = 131072 / 32768");
    expect(translate("en", "no.such.key")).toBe("no.such.key");
  });
});

describe("language menu", () => {
  it("language menu switches and persists", () => {
    const first = render(<App />);
    const menu = screen.getByRole("combobox", { name: /Language/ }) as HTMLSelectElement;
    expect(menu.value).toBe("en");
    expect(screen.getByRole("tab", { name: "Generate" })).toBeTruthy();

    fireEvent.change(menu, { target: { value: "ko" } });
    expect(screen.getByRole("tab", { name: "생성" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "검사" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "복사" }).length).toBeGreaterThan(0);
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe("ko");

    // A fresh render (like a page reload) keeps the choice, even though the browser says English.
    first.unmount();
    render(<App />);
    expect((screen.getByRole("combobox", { name: /Language/ }) as HTMLSelectElement).value).toBe("ko");
    expect(screen.getByRole("tab", { name: "생성" })).toBeTruthy();
  });

  it("finding text switches to Korean", () => {
    render(<App />);
    fireEvent.change(screen.getByRole("combobox", { name: /Language/ }), { target: { value: "ko" } });
    fireEvent.click(screen.getByRole("tab", { name: "검사" }));
    fireEvent.change(screen.getByLabelText("기존 명령·설정 검사"), {
      target: { value: `vllm serve Qwen/Qwen3-8B --rope-scaling '{"rope_type":"yarn","factor":4.0}' --max-model-len 131072` },
    });
    expect(screen.getByText(/vLLM 0\.32에는 --rope-scaling/)).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox", { name: /Language/ }), { target: { value: "en" } });
    expect(screen.getByText(/vLLM 0\.32 no longer has --rope-scaling/)).toBeTruthy();
  });

  it("first run detects ko else en", () => {
    setNavigatorLanguage("ko-KR");
    const ko = render(<App />);
    expect(screen.getByRole("tab", { name: "생성" })).toBeTruthy();
    ko.unmount();

    window.localStorage.clear();
    setNavigatorLanguage("fr-FR");
    render(<App />);
    expect(screen.getByRole("tab", { name: "Generate" })).toBeTruthy();
  });

  it("a stored choice wins over the browser language", () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, "en");
    setNavigatorLanguage("ko-KR");
    render(<App />);
    expect(screen.getByRole("tab", { name: "Generate" })).toBeTruthy();
  });
});
