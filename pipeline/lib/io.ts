import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { PATHS } from "../config.js";

export async function ensureProjectDirectories(): Promise<void> {
  await Promise.all(
    [
      PATHS.rawDir,
      PATHS.canonicalDir,
      PATHS.annotationsDir,
      PATHS.derivedDir,
      PATHS.publicDir,
      PATHS.publicMessagesDir,
      PATHS.cacheDir,
    ].map((directory) => fs.mkdir(directory, { recursive: true })),
  );
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

export async function writeNdjson<T>(filePath: string, rows: T[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const content = rows.map((row) => JSON.stringify(row)).join("\n");
  await fs.writeFile(filePath, `${content}\n`, "utf8");
}

export async function readNdjson<T>(filePath: string): Promise<T[]> {
  const content = await fs.readFile(filePath, "utf8");
  return content
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export function createContentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function groupBy<T, K extends string | number>(
  values: T[],
  getKey: (value: T) => K,
): Map<K, T[]> {
  const grouped = new Map<K, T[]>();

  for (const value of values) {
    const key = getKey(value);
    const current = grouped.get(key);
    if (current) {
      current.push(value);
    } else {
      grouped.set(key, [value]);
    }
  }

  return grouped;
}
