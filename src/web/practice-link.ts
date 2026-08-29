export type MemorizationLevel = "full" | "first-words" | "initials" | "hidden";

export interface SharedPractice {
  surahIds: number[];
  reciterId: number;
  ayahRepeats: number;
  surahRepeats: number;
  cycles: number | "forever";
  ayahDelay: number;
  surahDelay: number;
  memorization: MemorizationLevel;
  language: "en" | "ar";
}

const boundedInteger = (value: string | null, fallback: number, minimum: number, maximum: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
};

export function encodePracticeLink(config: SharedPractice): URLSearchParams {
  const params = new URLSearchParams();
  params.set("surahs", [...new Set(config.surahIds)].sort((a, b) => a - b).join(","));
  params.set("reciter", String(config.reciterId));
  params.set("ayahRepeats", String(config.ayahRepeats));
  params.set("surahRepeats", String(config.surahRepeats));
  params.set("cycles", String(config.cycles));
  params.set("ayahDelay", String(config.ayahDelay));
  params.set("surahDelay", String(config.surahDelay));
  params.set("memorization", config.memorization);
  params.set("lang", config.language);
  return params;
}

export function decodePracticeLink(params: URLSearchParams): Partial<SharedPractice> {
  const result: Partial<SharedPractice> = {};
  const surahIds = (params.get("surahs") ?? "")
    .split(",")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id >= 1 && id <= 114);
  if (surahIds.length) result.surahIds = [...new Set(surahIds)];
  if (params.has("reciter")) result.reciterId = boundedInteger(params.get("reciter"), 6, 1, 10_000);
  if (params.has("ayahRepeats")) result.ayahRepeats = boundedInteger(params.get("ayahRepeats"), 1, 1, 100);
  if (params.has("surahRepeats")) result.surahRepeats = boundedInteger(params.get("surahRepeats"), 3, 1, 100);
  const cycles = params.get("cycles");
  if (cycles === "forever") result.cycles = "forever";
  else if (cycles !== null) result.cycles = boundedInteger(cycles, 1, 1, 100);
  if (params.has("ayahDelay")) result.ayahDelay = boundedInteger(params.get("ayahDelay"), 0, 0, 30);
  if (params.has("surahDelay")) result.surahDelay = boundedInteger(params.get("surahDelay"), 0, 0, 30);
  const memorization = params.get("memorization");
  if (memorization === "full" || memorization === "first-words" || memorization === "initials" || memorization === "hidden") {
    result.memorization = memorization;
  }
  const language = params.get("lang");
  if (language === "en" || language === "ar") result.language = language;
  return result;
}
