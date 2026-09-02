export const TAJWEED_RULE_IDS = [
  "ham_wasl",
  "laam_shamsiyah",
  "madda_normal",
  "madda_permissible",
  "madda_necessary",
  "madda_obligatory_monfasel",
  "madda_obligatory_mottasel",
  "qalaqah",
  "ghunnah",
  "ikhafa",
  "ikhafa_shafawi",
  "idgham_ghunnah",
  "idgham_wo_ghunnah",
  "idgham_shafawi",
  "iqlab",
  "slnt",
] as const;

export type TajweedRuleId = (typeof TAJWEED_RULE_IDS)[number];

const TAJWEED_RULE_SET = new Set<string>(TAJWEED_RULE_IDS);
const LEGACY_RULE_NAMES: Record<string, TajweedRuleId> = {
  qlq: "qalaqah",
  ghn: "ghunnah",
  ikhf: "ikhafa",
  ikhf_shfw: "ikhafa_shafawi",
  idghm_shfw: "idgham_shafawi",
  iqlb: "iqlab",
};

export function extractTajweedRules(markup?: string): TajweedRuleId[] {
  if (!markup) return [];

  const rules: TajweedRuleId[] = [];
  const seen = new Set<TajweedRuleId>();
  const tagPattern =
    /<(?:rule|tajweed)\b[^>]*\bclass=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;

  for (const match of markup.matchAll(tagPattern)) {
    const classNames = (match[1] ?? match[2] ?? match[3] ?? "").split(/\s+/);
    for (const className of classNames) {
      const normalized = LEGACY_RULE_NAMES[className] ?? className;
      if (!TAJWEED_RULE_SET.has(normalized)) continue;
      const rule = normalized as TajweedRuleId;
      if (seen.has(rule)) continue;
      seen.add(rule);
      rules.push(rule);
    }
  }

  return rules;
}
