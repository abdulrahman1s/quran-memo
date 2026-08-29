function positiveInteger(value: string, label: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be a positive integer.`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return number;
}

export function parseSurahSpec(spec: string): number[] {
  const selected = new Set<number>();
  const parts = spec.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    throw new Error("Choose at least one surah.");
  }

  for (const part of parts) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = positiveInteger(range[1]!, "Surah range start");
      const end = positiveInteger(range[2]!, "Surah range end");
      if (start > end) {
        throw new Error(`Surah range ${part} is reversed.`);
      }
      if (start < 1 || end > 114) {
        throw new Error(`Surah range ${part} must stay between 1 and 114.`);
      }
      for (let id = start; id <= end; id += 1) selected.add(id);
      continue;
    }

    const id = positiveInteger(part, "Surah number");
    if (id > 114) throw new Error(`Surah number ${id} must be between 1 and 114.`);
    selected.add(id);
  }

  return [...selected].sort((a, b) => a - b);
}
