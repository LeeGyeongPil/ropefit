// Small formatting and version helpers shared by generators and lint rules.

/** 4 -> "4.0", 1.25 -> "1.25" (Python-style float text used in JSON overrides). */
export function fmtFloat(n: number): string {
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

/** Round up to 0.01 without float noise: 4 -> 4, 3.0517578 -> 3.06. */
export function ceil2(x: number): number {
  return Math.ceil(x * 100 - 1e-9) / 100;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** "0.32.1rc2" -> [0, 32, 1]; missing parts are 0. Returns null for non-version text. */
export function parseVersion(v: string): [number, number, number] | null {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(v.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

export function compareVersions(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] as number) - (b[i] as number);
    if (d !== 0) return d;
  }
  return 0;
}

/** Quote a shell word only when it needs it; <placeholder> words stay readable. */
export function shellQuote(s: string): string {
  if (/^<[\w.-]+>$/.test(s) || /^[\w./:@=+,-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
