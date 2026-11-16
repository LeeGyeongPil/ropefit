// Fetch the public config.json of a Hugging Face model. This is the only network call in the app.
import { HfFetchError } from "./types";

const ID_RE = /^[A-Za-z0-9][\w.-]*\/[A-Za-z0-9][\w.-]*$/;

export function hfConfigUrl(modelId: string): string {
  return `https://huggingface.co/${modelId}/resolve/main/config.json`;
}

export async function fetchHfConfig(modelId: string, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<unknown> {
  const id = modelId.trim();
  if (!ID_RE.test(id)) {
    throw new HfFetchError("invalid-id", `"${id}" is not a model ID. Use the form owner/name, for example Qwen/Qwen3-8B.`);
  }
  let res: Response;
  try {
    res = await fetchImpl(hfConfigUrl(id));
  } catch (err) {
    throw new HfFetchError("network", `Could not reach huggingface.co (${(err as Error).message}). Paste config.json instead.`);
  }
  if (res.status === 404) throw new HfFetchError("not-found", `No public config.json for "${id}". Check the ID or paste config.json instead.`);
  if (res.status === 401 || res.status === 403) throw new HfFetchError("gated", `"${id}" is gated or private. Paste its config.json instead.`);
  if (!res.ok) throw new HfFetchError("http", `Hugging Face answered HTTP ${res.status}. Paste config.json instead.`);
  try {
    return await res.json();
  } catch {
    throw new HfFetchError("bad-json", `The response for "${id}" was not valid JSON. Paste config.json instead.`);
  }
}
