import { useMemo, useState } from "react";
import { planScale } from "./core/plan";
import type { KvDtype, ModelRope } from "./core/types";
import { I18nProvider, useI18n } from "./i18n";
import { DEFAULT_SAMPLE_ID, getSample, loadSample } from "./samples";
import { CheckPanel } from "./ui/CheckPanel";
import { ExplainPanel } from "./ui/ExplainPanel";
import { GeneratePanel } from "./ui/GeneratePanel";
import { LangMenu } from "./ui/LangMenu";
import { ModelInput } from "./ui/ModelInput";
import { TargetForm } from "./ui/TargetForm";

type Tab = "generate" | "check" | "explain";
const TABS: Tab[] = ["generate", "check", "explain"];

function Main() {
  const { t } = useI18n();
  // The built-in sample is shown first, so the first render needs no network.
  const [model, setModel] = useState<ModelRope>(() => loadSample(DEFAULT_SAMPLE_ID));
  const [modelName, setModelName] = useState(getSample(DEFAULT_SAMPLE_ID).name);
  const [target, setTarget] = useState("131072");
  const [vram, setVram] = useState("");
  const [kvDtype, setKvDtype] = useState<KvDtype>("bf16");
  const [tab, setTab] = useState<Tab>("generate");

  const targetNum = Number(target);
  const vramNum = Number(vram) > 0 ? Number(vram) : undefined;
  const plan = useMemo(() => planScale(model, targetNum), [model, targetNum]);

  return (
    <main>
      <header>
        <div>
          <h1>{t("app.title")}</h1>
          <p>{t("app.tagline")}</p>
        </div>
        <LangMenu />
      </header>
      <p className="mock">{t("app.mock")}</p>
      <div className="inputs">
        <ModelInput
          model={model}
          modelName={modelName}
          onModel={(m, name) => {
            setModel(m);
            setModelName(name);
          }}
        />
        <TargetForm target={target} vram={vram} kvDtype={kvDtype} onTarget={setTarget} onVram={setVram} onKvDtype={setKvDtype} />
      </div>
      <div role="tablist" className="tabs">
        {TABS.map((id) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}>
            {t(`tab.${id}`)}
          </button>
        ))}
      </div>
      {tab === "generate" && <GeneratePanel model={model} modelName={modelName} plan={plan} vramGiB={vramNum} kvDtype={kvDtype} />}
      {tab === "check" && <CheckPanel model={model} vramGiB={vramNum} kvDtype={kvDtype} />}
      {tab === "explain" && <ExplainPanel model={model} plan={plan} />}
    </main>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <Main />
    </I18nProvider>
  );
}
