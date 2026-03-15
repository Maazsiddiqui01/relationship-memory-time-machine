const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "be",
  "for",
  "from",
  "hai",
  "i",
  "in",
  "is",
  "it",
  "ka",
  "ki",
  "ko",
  "me",
  "of",
  "on",
  "or",
  "the",
  "to",
  "tu",
  "tum",
  "u",
  "ya",
  "ye",
]);

export function normalizeWhitespace(value: string): string {
  if (!value) return value;
  let cleaned = value
    .replace(/â€™/g, "’")
    .replace(/â€˜/g, "‘")
    .replace(/â€œ/g, "“")
    .replace(/â€\x9d/gi, "”")
    .replace(/â€/g, "”")
    .replace(/â€”/g, "—")
    .replace(/â€“/g, "–")
    .replace(/â€¦/g, "…");
  return cleaned.replace(/\s+/gu, " ").trim();
}

export function normalizeText(value: string): string {
  return normalizeWhitespace(value.toLowerCase());
}

export function countEmoji(value: string): number {
  const matches = value.match(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu);
  return matches?.length ?? 0;
}

export function hasUrl(value: string): boolean {
  return /(https?:\/\/|www\.)/iu.test(value);
}

export function getWordCount(value: string): number {
  const tokens = normalizeWhitespace(value).split(" ").filter(Boolean);
  return tokens.length;
}

export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/u)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export function sentenceCase(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}
