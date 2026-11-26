import { describe, expect, it } from "vitest";
import data from "../src/rules/engines.json";
import known from "../src/core/knownModels.json";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function check(label: string, e: { sourceUrl?: string; checked?: string; basis?: string }) {
  expect({ label, url: /^https:\/\//.test(e.sourceUrl ?? "") }).toEqual({ label, url: true });
  expect({ label, date: DATE.test(e.checked ?? "") }).toEqual({ label, date: true });
  expect({ label, basis: ["source", "docs"].includes(e.basis ?? "") }).toEqual({ label, basis: true });
}

describe("rule data evidence", () => {
  it("every vLLM band has a source URL, checked date and basis", () => {
    expect(data.vllm.bands).toHaveLength(4);
    for (const b of data.vllm.bands) check(`band ${b.id}`, b);
  });
  it("every rule has a source URL, checked date and basis", () => {
    expect(Object.keys(data.rules)).toHaveLength(12);
    for (const [id, r] of Object.entries(data.rules)) check(`rule ${id}`, r);
  });
  it("every engine entry has evidence", () => {
    for (const [id, e] of Object.entries(data.engines)) check(`engine ${id}`, e);
  });
  it("known-model table entries carry a source URL", () => {
    for (const [id, m] of Object.entries(known.models)) expect({ id, url: m.sourceUrl.startsWith("https://") }).toEqual({ id, url: true });
  });
  it("band boundaries are contiguous", () => {
    const b = data.vllm.bands;
    for (let i = 1; i < b.length; i++) expect((b[i] as { from: string | null }).from).toBe((b[i - 1] as { to: string | null }).to);
  });
});
