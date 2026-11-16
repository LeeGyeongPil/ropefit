// Typed access to the version/rule data in engines.json (edit the JSON, not the code, when engines change).
import data from "./engines.json";
import type { Basis, EngineId, Severity } from "../core/types";
import { compareVersions, parseVersion } from "../core/util";

export type VllmBandId = "le-0.11.0" | "0.11.1" | "0.12-0.29" | "ge-0.30";

export interface VllmBand {
  id: VllmBandId;
  from: string | null;
  to: string | null;
  sourceUrl: string;
  checked: string;
  basis: Basis;
}

export interface RuleMeta {
  severity: Severity;
  sourceUrl: string;
  checked: string;
  basis: Basis;
}

export const VLLM_BANDS = data.vllm.bands as VllmBand[];
export const RULES = data.rules as Record<string, RuleMeta>;
export const RULE_IDS = Object.keys(RULES);
export const ENGINE_META = data.engines as Record<Exclude<EngineId, "vllm">, { sourceUrl: string; checked: string; basis: Basis }>;
export const CHECKED_UP_TO = data.checkedUpTo;

/** Representative version text per band, used when the user picks a band from a menu. */
export const BAND_VERSION: Record<VllmBandId, string> = {
  "le-0.11.0": "0.11.0",
  "0.11.1": "0.11.1",
  "0.12-0.29": "0.20.0",
  "ge-0.30": "0.32.0",
};

export function bandById(id: VllmBandId): VllmBand {
  return VLLM_BANDS.find((b) => b.id === id) as VllmBand;
}

/** Map a vLLM version string to its syntax band. Unknown text falls back to the newest band. */
export function bandForVersion(version: string | undefined): { band: VllmBand; beyondChecked: boolean } {
  const latest = bandById("ge-0.30");
  const v = version ? parseVersion(version) : null;
  if (!v) return { band: latest, beyondChecked: false };
  const band =
    VLLM_BANDS.find((b) => {
      const from = b.from ? (parseVersion(b.from) as [number, number, number]) : null;
      const to = b.to ? (parseVersion(b.to) as [number, number, number]) : null;
      return (!from || compareVersions(v, from) >= 0) && (!to || compareVersions(v, to) < 0);
    }) ?? latest;
  const checked = parseVersion(CHECKED_UP_TO.vllm) as [number, number, number];
  return { band, beyondChecked: compareVersions(v, checked) > 0 };
}
