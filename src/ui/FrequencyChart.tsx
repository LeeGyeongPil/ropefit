import { useI18n } from "../i18n";

interface Props {
  /** Wavelengths (tokens) per dimension pair. */
  base: number[];
  scaled: number[];
  rampLow?: number;
  rampHigh?: number;
}

const W = 640;
const H = 300;
const PAD = { l: 56, r: 16, t: 16, b: 40 };

export function FrequencyChart({ base, scaled, rampLow, rampHigh }: Props) {
  const { t } = useI18n();
  const all = [...base, ...scaled].map(Math.log10);
  const yMin = Math.floor(Math.min(...all));
  const yMax = Math.ceil(Math.max(...all));
  const n = base.length;
  const x = (i: number) => PAD.l + (i / Math.max(n - 1, 1)) * (W - PAD.l - PAD.r);
  const y = (w: number) => PAD.t + (1 - (Math.log10(w) - yMin) / Math.max(yMax - yMin, 1)) * (H - PAD.t - PAD.b);
  const line = (vals: number[]) => vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks: number[] = [];
  for (let e = yMin; e <= yMax; e++) ticks.push(e);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("explain.chart")} className="chart">
      {rampLow !== undefined && rampHigh !== undefined && (
        <rect className="ramp" x={x(rampLow)} y={PAD.t} width={Math.max(x(rampHigh) - x(rampLow), 2)} height={H - PAD.t - PAD.b} />
      )}
      {ticks.map((e) => (
        <g key={e}>
          <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(10 ** e)} y2={y(10 ** e)} />
          <text x={PAD.l - 6} y={y(10 ** e) + 4} textAnchor="end">{`1e${e}`}</text>
        </g>
      ))}
      <polyline className="line-base" fill="none" points={line(base)} />
      <polyline className="line-scaled" fill="none" points={line(scaled)} />
      <text x={W / 2} y={H - 8} textAnchor="middle">{t("explain.x")}</text>
      <text x={12} y={H / 2} transform={`rotate(-90 12 ${H / 2})`} textAnchor="middle">{t("explain.y")}</text>
      <text x={W - PAD.r - 4} y={PAD.t + 12} textAnchor="end" className="legend-base">{t("explain.legend.base")}</text>
      <text x={W - PAD.r - 4} y={PAD.t + 28} textAnchor="end" className="legend-scaled">{t("explain.legend.scaled")}</text>
    </svg>
  );
}
