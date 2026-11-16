import { useMemo, useState } from "react";
import type { ModelRope, ScalePlan } from "../core/types";
import { defaultInvFreq, dynamicInvFreq, linearInvFreq, wavelengths, yarnInvFreq } from "../core/yarn";
import { useI18n } from "../i18n";
import { FrequencyChart } from "./FrequencyChart";

type Method = "linear" | "yarn" | "dynamic";

export function ExplainPanel({ model, plan }: { model: ModelRope; plan: ScalePlan }) {
  const { t } = useI18n();
  const [method, setMethod] = useState<Method>("yarn");
  const [factorText, setFactorText] = useState("");
  // Default to the plan's factor; fall back to 4 so the chart always shows a change.
  const factor = Number(factorText) > 1 ? Number(factorText) : plan.kind === "yarn" ? plan.factor : 4;

  const data = useMemo(() => {
    const base = model.ropeTheta;
    const dim = model.rotaryDim;
    const original = defaultInvFreq(base, dim);
    if (method === "linear") return { scaled: linearInvFreq(base, dim, factor), original };
    if (method === "dynamic") return { scaled: dynamicInvFreq(base, dim, factor), original };
    const y = yarnInvFreq({ base, dim, factor, originalCtx: model.originalCtx });
    return { scaled: y.invFreq, original, ramp: [y.rampLow, y.rampHigh] as const, attention: y.attentionFactor };
  }, [model, method, factor]);

  return (
    <div role="tabpanel" aria-label={t("tab.explain")}>
      <h3>{t("explain.heading")}</h3>
      <label>
        {t("explain.method")}
        <select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
          {(["linear", "yarn", "dynamic"] as Method[]).map((m) => (
            <option key={m} value={m}>
              {t(`explain.method.${m}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("explain.factor")}
        <input inputMode="decimal" value={factorText} placeholder={String(factor)} onChange={(e) => setFactorText(e.target.value)} />
      </label>
      <FrequencyChart
        base={wavelengths(data.original)}
        scaled={wavelengths(data.scaled)}
        rampLow={data.ramp?.[0]}
        rampHigh={data.ramp?.[1]}
      />
      {data.ramp && <p>{t("explain.ramp", { low: data.ramp[0], high: data.ramp[1] })}</p>}
      {data.attention !== undefined && <p>{t("explain.attention", { value: data.attention.toFixed(4) })}</p>}
      <p className="note">{t("explain.text")}</p>
    </div>
  );
}
