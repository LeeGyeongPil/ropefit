import { useState } from "react";
import type { FormEvent } from "react";
import { fetchHfConfig } from "../core/hf";
import { modelFromGguf, readGgufFile } from "../core/gguf";
import { normalizeConfig } from "../core/normalize";
import { describeError } from "./errors";
import type { ModelRope } from "../core/types";
import { useI18n } from "../i18n";
import { SAMPLES, getSample, loadSample } from "../samples";

interface Props {
  model: ModelRope;
  modelName: string;
  onModel: (model: ModelRope, name: string) => void;
}

export function ModelInput({ model, modelName, onModel }: Props) {
  const { t } = useI18n();
  const [hfId, setHfId] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const describe = (err: unknown): string => describeError(t, err);

  // The only network call in the app: runs when the user submits a model ID.
  async function submitHf(e: FormEvent) {
    e.preventDefault();
    if (hfId.trim() === "") return;
    setBusy(true);
    setError(null);
    try {
      const cfg = await fetchHfConfig(hfId);
      onModel(normalizeConfig(cfg, { source: "hf" }), hfId.trim());
    } catch (err) {
      setError(`${describe(err)} ${t("model.fallback")}`);
      setPasteOpen(true);
    } finally {
      setBusy(false);
    }
  }

  function usePaste() {
    setError(null);
    try {
      onModel(normalizeConfig(JSON.parse(pasteText), { source: "paste" }), t("model.pastedName"));
    } catch (err) {
      setError(describe(err));
    }
  }

  async function pickGguf(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      onModel(modelFromGguf(await readGgufFile(file)), file.name);
    } catch (err) {
      setError(describe(err));
    }
  }

  const ex = model.existing;
  const exText = ex ? `${ex.type}${ex.factor !== undefined ? ` x${ex.factor}` : ""}` : t("model.existingNone");
  const sampleValue = SAMPLES.find((s) => s.name === modelName)?.id ?? "";

  return (
    <section className="panel" aria-labelledby="model-h">
      <h2 id="model-h">{t("model.heading")}</h2>
      <label>
        {t("model.sample")}
        <select
          value={sampleValue}
          onChange={(e) => {
            if (e.target.value) onModel(loadSample(e.target.value), getSample(e.target.value).name);
          }}
        >
          {sampleValue === "" && <option value="">-</option>}
          {SAMPLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.synthetic ? t("model.syntheticSuffix") : ""}
            </option>
          ))}
        </select>
      </label>
      <form onSubmit={submitHf} className="row">
        <label>
          {t("model.hfLabel")}
          <input value={hfId} placeholder={t("model.hfPlaceholder")} onChange={(e) => setHfId(e.target.value)} />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? t("model.loading") : t("model.hfButton")}
        </button>
      </form>
      <details open={pasteOpen} onToggle={(e) => setPasteOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>{t("model.pasteLabel")}</summary>
        <textarea
          aria-label={t("model.pasteLabel")}
          rows={6}
          value={pasteText}
          placeholder={t("model.pastePlaceholder")}
          onChange={(e) => setPasteText(e.target.value)}
        />
        <button type="button" onClick={usePaste}>
          {t("model.pasteButton")}
        </button>
      </details>
      <label>
        {t("model.ggufLabel")}
        <input type="file" accept=".gguf" onChange={(e) => void pickGguf(e.target.files?.[0])} />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <dl className="facts">
        <dt>{t("model.current", { name: modelName })}</dt>
        <dd />
        <dt>{t("model.theta")}</dt>
        <dd>{model.ropeTheta}</dd>
        <dt>{t("model.maxPos")}</dt>
        <dd>{model.maxPositionEmbeddings}</dd>
        <dt>{t("model.origCtx")}</dt>
        <dd>
          <input
            type="number"
            aria-label={t("model.origCtx")}
            value={model.originalCtx}
            min={1}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n > 0) onModel({ ...model, originalCtx: n, originalCtxSource: "user" }, modelName);
            }}
          />{" "}
          <small>({t(`model.origSource.${model.originalCtxSource}`)})</small>
        </dd>
        <dt>{t("model.rotaryDim")}</dt>
        <dd>{model.rotaryDim}</dd>
        <dt>{t("model.existing")}</dt>
        <dd>{exText}</dd>
      </dl>
      {model.notes.map((n) => (
        <p key={n} className="note">
          {t(`note.${n}`)}
        </p>
      ))}
    </section>
  );
}
