import { useMemo, useState } from "react";
import { lintText } from "../core/lint";
import type { EngineId, KvDtype, ModelRope } from "../core/types";
import { useI18n } from "../i18n";
import { CHECKED_UP_TO, RULE_IDS, RULES } from "../rules";
import { CopyButton } from "./CopyButton";
import { Evidence } from "./Evidence";

interface Props {
  model: ModelRope;
  vramGiB?: number;
  kvDtype: KvDtype;
}

const ENGINES: EngineId[] = ["llamacpp", "vllm", "sglang", "transformers", "ollama"];

export function CheckPanel({ model, vramGiB, kvDtype }: Props) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [engine, setEngine] = useState<EngineId | "auto">("auto");
  const [version, setVersion] = useState("0.32");

  const result = useMemo(
    () => (text.trim() === "" ? null : lintText(text, { model, vllmVersion: version, vramGiB, kvDtype }, engine === "auto" ? undefined : engine)),
    [text, model, version, vramGiB, kvDtype, engine],
  );

  return (
    <div role="tabpanel" aria-label={t("tab.check")}>
      <h3>{t("check.heading")}</h3>
      <label>
        {t("check.engine")}
        <select value={engine} onChange={(e) => setEngine(e.target.value as EngineId | "auto")}>
          <option value="auto">{t("engine.auto")}</option>
          {ENGINES.map((e) => (
            <option key={e} value={e}>
              {t(`engine.${e}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("check.vllmVersion")}
        <input value={version} onChange={(e) => setVersion(e.target.value)} />
      </label>
      <textarea
        aria-label={t("check.heading")}
        rows={7}
        spellCheck={false}
        value={text}
        placeholder={t("check.placeholder")}
        onChange={(e) => setText(e.target.value)}
      />
      {result === null && <p className="note">{t("check.empty")}</p>}
      {result?.beyondChecked && <p className="note">{t("check.beyond", { version: CHECKED_UP_TO.vllm })}</p>}
      {result?.parsed.errorInfo.map((err, i) => (
        <p key={`${err.code}-${i}`} className="error" role="alert">
          {t(`error.parse.${err.code}`, err.params)}
        </p>
      ))}
      {result && result.parsed.engine !== "unknown" && result.findings.length === 0 && (
        <p className="ok">{t("check.noFindings", { count: RULE_IDS.length })}</p>
      )}
      <ul className="findings">
        {result?.findings.map((f) => {
          const meta = RULES[f.ruleId];
          return (
            <li key={f.ruleId} className={`finding finding-${f.severity}`} data-rule={f.ruleId}>
              <p>
                <span className="sev">{t(`severity.${f.severity}`)}</span> <code>{f.ruleId}</code>
              </p>
              <h4>{t(`rule.${f.ruleId}.title`, f.params)}</h4>
              <p>{t(f.params.estimated === 1 ? `rule.${f.ruleId}.body.estimated` : `rule.${f.ruleId}.body`, f.params)}</p>
              {f.fix && (
                <div className="block">
                  <div className="block-head">
                    <strong>{t("check.suggested")}</strong>
                    <CopyButton text={f.fix} />
                  </div>
                  <pre>{f.fix}</pre>
                </div>
              )}
              <Evidence basis={f.basis} sourceUrl={f.sourceUrl} checked={meta?.checked ?? ""} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
