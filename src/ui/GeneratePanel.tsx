import { useState } from "react";
import { generate } from "../core/generate";
import { estimateKv } from "../core/kv";
import type { EngineId, KvDtype, ModelRope, ScalePlan } from "../core/types";
import { useI18n } from "../i18n";
import { VLLM_BANDS } from "../rules";
import type { VllmBandId } from "../rules";
import { CopyButton } from "./CopyButton";
import { Evidence } from "./Evidence";

const ENGINES: EngineId[] = ["llamacpp", "vllm", "sglang", "transformers", "ollama"];

interface Props {
  model: ModelRope;
  modelName: string;
  plan: ScalePlan;
  vramGiB?: number;
  kvDtype: KvDtype;
}

export function GeneratePanel({ model, modelName, plan, vramGiB, kvDtype }: Props) {
  const { t } = useI18n();
  const [engine, setEngine] = useState<EngineId>("llamacpp");
  const [band, setBand] = useState<VllmBandId>("ge-0.30");
  const out = generate(engine, { model, plan, modelName: modelName.includes(" ") ? "<model>" : modelName, vllmBand: band });
  const kv = estimateKv(model, plan.targetCtx, kvDtype);
  const tooBig = kv.supported && vramGiB !== undefined && vramGiB > 0 && kv.gib > vramGiB;

  return (
    <div role="tabpanel" aria-label={t("tab.generate")}>
      <div className="plan">
        <h3>{t("plan.heading")}</h3>
        <p>
          {plan.notes.includes("invalid-target")
            ? t("plan.invalid")
            : plan.kind === "yarn"
              ? t("plan.yarn", { factor: plan.factor, target: plan.targetCtx, orig: plan.originalCtx })
              : plan.kind === "none"
                ? t("plan.none", { target: plan.targetCtx, orig: plan.originalCtx })
                : t("plan.nativeKeep", { target: plan.targetCtx })}
        </p>
        {kv.supported ? (
          <p>{t("kv.estimate", { gib: kv.gib.toFixed(2), dtype: kvDtype, tokens: plan.targetCtx })}</p>
        ) : (
          <p>{t(`kv.unsupported.${kv.reason ?? "unknown-shape"}`)}</p>
        )}
        {tooBig && (
          <p className="warning" role="status">
            {t("rule.KV_EXCEEDS_VRAM.title", { kv: kv.gib.toFixed(2), vram: vramGiB ?? 0, ctx: plan.targetCtx })}
          </p>
        )}
      </div>

      <div className="engines" role="group" aria-label={t("engine.label")}>
        {ENGINES.map((e) => (
          <button key={e} type="button" aria-pressed={engine === e} onClick={() => setEngine(e)}>
            {t(`engine.${e}`)}
          </button>
        ))}
      </div>
      {engine === "vllm" && (
        <label>
          {t("vllm.band")}
          <select value={band} onChange={(e) => setBand(e.target.value as VllmBandId)}>
            {VLLM_BANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {t(`vllm.band.${b.id}`)}
              </option>
            ))}
          </select>
        </label>
      )}

      {out.blocks.map((b, i) =>
        b.kind === "note" ? (
          <p key={i} className="note">
            {t(`note.${b.text}`)}
          </p>
        ) : (
          <div key={i} className="block">
            <div className="block-head">
              <strong>{t(`block.${b.label}`)}</strong>
              <CopyButton text={b.text} />
            </div>
            <pre>{b.text}</pre>
          </div>
        ),
      )}
      {out.notes.map((n) => (
        <p key={n} className="note">
          {t(`note.${n}`)}
        </p>
      ))}
      <Evidence basis={out.basis} sourceUrl={out.sourceUrl} checked={out.checked} />
    </div>
  );
}
