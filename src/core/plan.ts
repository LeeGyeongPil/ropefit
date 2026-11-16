// Decide what to do for a target length: nothing, a YaRN factor, or keep the model's own scheme.
import type { ModelRope, ScalePlan } from "./types";
import { ceil2 } from "./util";

const NATIVE_TYPES = new Set(["llama3", "longrope", "su", "per-layer"]);

export function planScale(model: ModelRope, targetCtx: number): ScalePlan {
  const orig = model.originalCtx;
  const base = { targetCtx, originalCtx: orig };
  if (!Number.isFinite(targetCtx) || targetCtx <= 0) {
    return { ...base, kind: "none", factor: 1, notes: ["invalid-target"] };
  }
  const notes: string[] = [];
  if (model.originalCtxSource === "max_position_embeddings" && !model.existing) notes.push("orig-unverified");
  const ex = model.existing;

  // Model-own schemes (llama3, longrope, per-layer): overriding them breaks the model.
  if (ex && NATIVE_TYPES.has(ex.type)) {
    if (targetCtx > model.maxPositionEmbeddings) notes.push("beyond-native");
    return { ...base, kind: "native-keep", factor: ex.factor ?? 1, notes: [...notes, "native-scheme"] };
  }
  // Author already ships YaRN that covers the target: leave it alone.
  if (ex && ex.type === "yarn" && ex.factor !== undefined) {
    const capacity = ex.factor * (ex.originalMaxPositionEmbeddings ?? orig);
    if (targetCtx <= capacity) return { ...base, kind: "native-keep", factor: ex.factor, notes: [...notes, "already-yarn"] };
    notes.push("replaces-author-values");
  }
  if (targetCtx <= orig) return { ...base, kind: "none", factor: 1, notes: [...notes, "no-scaling-needed"] };
  return { ...base, kind: "yarn", factor: ceil2(targetCtx / orig), notes };
}
