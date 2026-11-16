import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export function fixturePath(rel: string): string {
  return join(here, rel);
}

export function readFixture(rel: string): string {
  return readFileSync(fixturePath(rel), "utf8");
}

export function listFixtures(rel: string): string[] {
  return readdirSync(fixturePath(rel)).sort();
}
