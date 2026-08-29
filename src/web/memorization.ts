import type { MemorizationLevel } from "./practice-link.ts";

export interface DisplayWord {
  position: number;
  text: string;
}

export function memorizationWords(words: readonly DisplayWord[], level: MemorizationLevel): DisplayWord[] {
  if (level === "full") return [...words];
  if (level === "hidden") return [];
  if (level === "first-words") return words.slice(0, Math.min(3, words.length));
  return words.map((word) => ({ ...word, text: [...word.text][0] ?? "" }));
}
