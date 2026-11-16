// Tiny POSIX-like tokenizer for pasted serving commands: single and double quotes,
// backslash escapes, backslash-newline continuations, # comments, and it stops at the
// first unquoted pipe / && / || / ; so only the first command is analysed.
import { ShellParseError } from "./types";

export function splitShell(input: string): string[] {
  const words: string[] = [];
  let cur = "";
  let inWord = false;
  let i = 0;
  const n = input.length;
  const push = () => {
    if (inWord) words.push(cur);
    cur = "";
    inWord = false;
  };
  while (i < n) {
    const c = input[i] as string;
    if (c === "\\") {
      const next = input[i + 1];
      if (next === "\n") { i += 2; continue; }
      if (next === "\r" && input[i + 2] === "\n") { i += 3; continue; }
      if (next !== undefined) { cur += next; inWord = true; i += 2; continue; }
      i += 1;
      continue;
    }
    if (c === "'") {
      const end = input.indexOf("'", i + 1);
      if (end === -1) throw new ShellParseError("Unclosed single quote. Close the quote or paste the whole command.", "unclosed-single");
      cur += input.slice(i + 1, end);
      inWord = true;
      i = end + 1;
      continue;
    }
    if (c === '"') {
      i += 1;
      let closed = false;
      while (i < n) {
        const d = input[i] as string;
        if (d === "\\" && i + 1 < n && '"\\$`\n'.includes(input[i + 1] as string)) {
          if (input[i + 1] !== "\n") cur += input[i + 1];
          i += 2;
          continue;
        }
        if (d === '"') { closed = true; i += 1; break; }
        cur += d;
        i += 1;
      }
      if (!closed) throw new ShellParseError("Unclosed double quote. Close the quote or paste the whole command.", "unclosed-double");
      inWord = true;
      continue;
    }
    if (c === "#" && !inWord) {
      while (i < n && input[i] !== "\n") i += 1;
      continue;
    }
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { push(); i += 1; continue; }
    if (!inWord && (c === ";" || c === "|" || (c === "&" && input[i + 1] === "&"))) {
      // Words before the operator form the command; ignore everything after.
      if (words.length > 0) break;
      i += 1;
      continue;
    }
    if (inWord && (c === ";" || c === "|")) { push(); break; }
    cur += c;
    inWord = true;
    i += 1;
  }
  push();
  return words;
}

const ENV_RE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s;

/** Split leading KEY=VAL words from the program and its arguments. */
export function splitEnv(words: string[]): { env: Record<string, string>; rest: string[] } {
  const env: Record<string, string> = {};
  let idx = 0;
  while (idx < words.length) {
    const m = ENV_RE.exec(words[idx] as string);
    if (!m) break;
    env[m[1] as string] = m[2] as string;
    idx += 1;
  }
  return { env, rest: words.slice(idx) };
}
