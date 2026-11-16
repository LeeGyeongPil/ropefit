import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../src/App";

const TINY_CONFIG = {
  model_type: "llama",
  head_dim: 64,
  hidden_size: 2048,
  num_attention_heads: 32,
  num_hidden_layers: 16,
  num_key_value_heads: 8,
  max_position_embeddings: 8192,
  rope_theta: 10000,
};

type FakeResponse = { ok: boolean; status: number; json: () => Promise<unknown> };
const reply = (status: number, body: unknown = {}): FakeResponse => ({ ok: status >= 200 && status < 300, status, json: async () => body });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function submitModelId(id: string) {
  fireEvent.change(screen.getByLabelText("Hugging Face model ID"), { target: { value: id } });
  fireEvent.click(screen.getByRole("button", { name: "Fetch config.json" }));
}

describe("app network boundary", () => {
  it("renders sample without network", () => {
    render(<App />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Current model: Qwen\/Qwen3-8B/)).toBeTruthy();
    expect(screen.getByText(/--rope-scaling yarn --rope-scale 4 --yarn-orig-ctx 32768/)).toBeTruthy();
    // switching tabs and engines does not touch the network either
    fireEvent.click(screen.getByRole("button", { name: "vLLM" }));
    fireEvent.click(screen.getByRole("tab", { name: "Explain" }));
    expect(screen.getByText(/YaRN ramp: dimensions 23 to 40/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("states honestly that the samples are practice (mock) data", () => {
    render(<App />);
    expect(screen.getByText(/Practice \(mock\) mode/)).toBeTruthy();
  });

  it("fetches config only on submit", async () => {
    fetchMock.mockResolvedValue(reply(200, TINY_CONFIG));
    render(<App />);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    submitModelId("Org/Tiny");
    await waitFor(() => expect(screen.getByText(/Current model: Org\/Tiny/)).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://huggingface.co/Org/Tiny/resolve/main/config.json");
    // 131072 target vs max_position_embeddings 8192 => a YaRN factor of 16 against the assumed length
    expect(screen.getByText(/YaRN factor 16 = 131072 \/ 8192/)).toBeTruthy();
  });

  it("hf errors fall back to paste", async () => {
    for (const [label, setup, message] of [
      ["404", () => fetchMock.mockResolvedValueOnce(reply(404)), /No public config\.json/],
      ["401", () => fetchMock.mockResolvedValueOnce(reply(401)), /gated or private/],
      ["network", () => fetchMock.mockRejectedValueOnce(new TypeError("offline")), /Could not reach huggingface\.co/],
    ] as const) {
      setup();
      const view = render(<App />);
      submitModelId("Org/Missing");
      const alert = await screen.findByRole("alert");
      expect(alert.textContent, label).toMatch(message);
      expect(alert.textContent, label).toMatch(/Paste config\.json below/);
      const details = view.container.querySelector("details") as HTMLDetailsElement;
      expect(details.open, label).toBe(true);
      // The model stays on the sample, so the page keeps working.
      expect(screen.getByText(/Current model: Qwen\/Qwen3-8B/)).toBeTruthy();
      cleanup();
    }
  });

  it("pasted config replaces the model without any request", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Or paste config.json", { selector: "textarea" }), { target: { value: JSON.stringify(TINY_CONFIG) } });
    fireEvent.click(screen.getByRole("button", { name: "Use pasted config" }));
    expect(screen.getByText(/Current model: pasted config/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("invalid pasted config shows a message instead of crashing", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Or paste config.json", { selector: "textarea" }), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Use pasted config" }));
    expect(screen.getByRole("alert").textContent).toMatch(/max_position_embeddings/);
  });

  it("check tab lints a pasted command and shows evidence", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "Check" }));
    fireEvent.change(screen.getByLabelText("Check an existing command or config"), {
      target: { value: "llama-server -m x.gguf -c 131072 --rope-scale 4" },
    });
    expect(screen.getByText(/--rope-scale alone means linear scaling/)).toBeTruthy();
    const link = screen.getAllByRole("link", { name: "evidence" })[0] as HTMLAnchorElement;
    expect(link.href).toMatch(/^https:\/\//);
  });
});
