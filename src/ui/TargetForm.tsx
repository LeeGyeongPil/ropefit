import { KV_DTYPES } from "../core/kv";
import type { KvDtype } from "../core/types";
import { useI18n } from "../i18n";

interface Props {
  target: string;
  vram: string;
  kvDtype: KvDtype;
  onTarget: (v: string) => void;
  onVram: (v: string) => void;
  onKvDtype: (v: KvDtype) => void;
}

export function TargetForm({ target, vram, kvDtype, onTarget, onVram, onKvDtype }: Props) {
  const { t } = useI18n();
  return (
    <section className="panel" aria-labelledby="target-h">
      <h2 id="target-h">{t("target.heading")}</h2>
      <label>
        {t("target.ctx")}
        <input inputMode="numeric" value={target} onChange={(e) => onTarget(e.target.value)} />
      </label>
      <label>
        {t("target.vram")}
        <input inputMode="decimal" value={vram} onChange={(e) => onVram(e.target.value)} />
      </label>
      <label>
        {t("target.kvDtype")}
        <select value={kvDtype} onChange={(e) => onKvDtype(e.target.value as KvDtype)}>
          {KV_DTYPES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
