// RoPE frequency math. Follows the YaRN paper (arXiv:2309.00071) and matches the
// transformers 5.23.0 reference implementation (see tests/fixtures/tf-yarn-qwen3.json).

export interface YarnOptions {
  base: number;
  /** Rotary dimension (head_dim x partial_rotary_factor). */
  dim: number;
  factor: number;
  originalCtx: number;
  betaFast?: number;
  betaSlow?: number;
  truncate?: boolean;
}

export interface YarnResult {
  invFreq: number[];
  /** Attention temperature 0.1 * ln(factor) + 1 (1 when factor <= 1). */
  attentionFactor: number;
  /** First and last dimension index of the interpolation ramp. */
  rampLow: number;
  rampHigh: number;
}

export function defaultInvFreq(base: number, dim: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < dim / 2; i++) out.push(1 / Math.pow(base, (2 * i) / dim));
  return out;
}

/** Linear (position interpolation): every frequency divided by the factor. */
export function linearInvFreq(base: number, dim: number, factor: number): number[] {
  return defaultInvFreq(base, dim).map((f) => f / factor);
}

/** Dynamic NTK-aware scaling evaluated at the full extended length. */
export function dynamicInvFreq(base: number, dim: number, factor: number): number[] {
  const scaledBase = base * Math.pow(factor, dim / (dim - 2));
  return defaultInvFreq(scaledBase, dim);
}

export function attentionFactorFor(factor: number): number {
  return factor > 1 ? 0.1 * Math.log(factor) + 1 : 1;
}

export function yarnInvFreq(o: YarnOptions): YarnResult {
  const { base, dim, factor, originalCtx } = o;
  const betaFast = o.betaFast ?? 32;
  const betaSlow = o.betaSlow ?? 1;
  const truncate = o.truncate ?? true;
  // Dimension index whose wavelength completes nRot turns inside the original length.
  const corr = (nRot: number) => (dim * Math.log(originalCtx / (nRot * 2 * Math.PI))) / (2 * Math.log(base));
  let low = corr(betaFast);
  let high = corr(betaSlow);
  if (truncate) {
    low = Math.floor(low);
    high = Math.ceil(high);
  }
  low = Math.max(low, 0);
  high = Math.min(high, dim - 1);
  const span = low === high ? high + 0.001 - low : high - low;
  const invFreq: number[] = [];
  for (let i = 0; i < dim / 2; i++) {
    const f = 1 / Math.pow(base, (2 * i) / dim);
    const ramp = Math.min(Math.max((i - low) / span, 0), 1);
    // ramp 0 = keep the original frequency, ramp 1 = fully interpolated.
    invFreq.push((f / factor) * ramp + f * (1 - ramp));
  }
  return { invFreq, attentionFactor: attentionFactorFor(factor), rampLow: low, rampHigh: high };
}

/** Wavelength in tokens for one full rotation of each dimension pair. */
export function wavelengths(invFreq: number[]): number[] {
  return invFreq.map((f) => (2 * Math.PI) / f);
}
