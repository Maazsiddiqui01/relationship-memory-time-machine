import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";

import { humanizeArchetypeLabel } from "@/lib/curation";
import {
  lensFromSlug,
  listStoryLensSlugs,
  type StoryLens,
} from "@/lib/story-lens-shared";

const PUBLIC_DIR = path.join(process.cwd(), "data", "public");

function readPublicJson<T>(fileName: string): Promise<T> {
  return fs.readFile(path.join(PUBLIC_DIR, fileName), "utf8").then((content) => JSON.parse(content) as T);
}

export const loadStoryLenses = cache(async (): Promise<StoryLens[]> =>
  readPublicJson<StoryLens[]>("story_lenses.json"),
);

export const loadStoryLens = cache(async (slug: string): Promise<StoryLens | undefined> => {
  const archetype = lensFromSlug(slug);
  if (!archetype) {
    return undefined;
  }

  const allLenses = await loadStoryLenses();
  return allLenses.find((lens) => lens.archetype === archetype);
});

export async function loadTopStoryLenses(limit = 6): Promise<StoryLens[]> {
  const allLenses = await loadStoryLenses();
  return allLenses.slice(0, limit);
}

export { listStoryLensSlugs };

export function fallbackLensLabel(slug: string): string {
  const archetype = lensFromSlug(slug);
  return archetype ? humanizeArchetypeLabel(archetype) : slug;
}
