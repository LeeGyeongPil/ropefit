// Turns core errors (code + params) into text in the current UI language.
import { ConfigShapeError, GgufParseError, HfFetchError, ShellParseError } from "../core/types";
import type { TFunction } from "../i18n";

export function describeError(t: TFunction, err: unknown): string {
  if (err instanceof HfFetchError) return t(`error.hf.${err.code}`);
  if (err instanceof ConfigShapeError) {
    return t(err.code === "generic" ? "error.generic" : `error.config.${err.code}`, err.params);
  }
  if (err instanceof GgufParseError) return t(`error.gguf.${err.code}`, err.params);
  if (err instanceof ShellParseError) return t(`error.parse.${err.code}`);
  if (err instanceof SyntaxError) return t("error.pasteBadJson");
  return t("error.generic");
}
