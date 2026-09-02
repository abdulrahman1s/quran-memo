import type { TajweedRuleId } from "../tajweed.ts";
import type { Language } from "./i18n.ts";

interface TajweedRuleCopy {
  name: string;
  description: string;
}

const COPY: Record<TajweedRuleId, Record<Language, TajweedRuleCopy>> = {
  ham_wasl: {
    en: {
      name: "Joining hamzah",
      description:
        "Pronounce it when starting here; omit it when joining from the word before it.",
    },
    ar: {
      name: "همزة الوصل",
      description: "تُنطق عند البدء بالكلمة، وتسقط عند وصلها بما قبلها.",
    },
  },
  laam_shamsiyah: {
    en: {
      name: "Solar lām",
      description:
        "Do not pronounce the lām; merge it into the following sun letter and stress that letter.",
    },
    ar: {
      name: "اللام الشمسية",
      description: "لا تُنطق اللام، وتُدغم في الحرف الشمسي بعدها مع تشديده.",
    },
  },
  madda_normal: {
    en: {
      name: "Natural elongation",
      description: "Stretch the sound for two counts.",
    },
    ar: {
      name: "المد الطبيعي",
      description: "يُمد الصوت مقدار حركتين.",
    },
  },
  madda_permissible: {
    en: {
      name: "Permissible elongation",
      description:
        "The elongation may be read for two, four, or six counts according to the recitation context.",
    },
    ar: {
      name: "المد الجائز",
      description: "يجوز مده حركتين أو أربعًا أو ستًا بحسب موضع القراءة.",
    },
  },
  madda_necessary: {
    en: {
      name: "Necessary elongation",
      description: "Stretch the sound for six counts.",
    },
    ar: {
      name: "المد اللازم",
      description: "يُمد الصوت مقدار ست حركات.",
    },
  },
  madda_obligatory_monfasel: {
    en: {
      name: "Separated elongation",
      description:
        "A madd letter is followed by a hamzah in the next word; keep the chosen count consistent.",
    },
    ar: {
      name: "المد المنفصل",
      description:
        "يأتي حرف المد في آخر كلمة والهمزة في أول التالية، ويُلتزم مقدار المد المختار.",
    },
  },
  madda_obligatory_mottasel: {
    en: {
      name: "Connected elongation",
      description:
        "A madd letter is followed by a hamzah in the same word; stretch it for four or five counts.",
    },
    ar: {
      name: "المد المتصل",
      description:
        "يأتي حرف المد وبعده همزة في الكلمة نفسها، ويُمد أربعًا أو خمس حركات.",
    },
  },
  qalaqah: {
    en: {
      name: "Qalqalah",
      description: "Give the still letter a light echo without adding a vowel.",
    },
    ar: {
      name: "القلقلة",
      description: "يُسمع للحرف الساكن نبرة خفيفة من غير إضافة حركة.",
    },
  },
  ghunnah: {
    en: {
      name: "Ghunnah",
      description: "Hold the nasal sound for two counts.",
    },
    ar: {
      name: "الغنة",
      description: "يُحافظ على صوت الغنة مقدار حركتين.",
    },
  },
  ikhafa: {
    en: {
      name: "Concealment",
      description:
        "Conceal the nūn sound between clarity and merging, with a two-count ghunnah.",
    },
    ar: {
      name: "الإخفاء الحقيقي",
      description: "يُخفى صوت النون بين الإظهار والإدغام مع غنة مقدار حركتين.",
    },
  },
  ikhafa_shafawi: {
    en: {
      name: "Labial concealment",
      description: "Conceal the still mīm before bāʾ with a two-count ghunnah.",
    },
    ar: {
      name: "الإخفاء الشفوي",
      description: "تُخفى الميم الساكنة عند الباء مع غنة مقدار حركتين.",
    },
  },
  idgham_ghunnah: {
    en: {
      name: "Merging with ghunnah",
      description:
        "Merge the nūn or tanwīn into the following letter with a two-count nasal sound.",
    },
    ar: {
      name: "الإدغام بغنة",
      description:
        "تُدغم النون أو التنوين في الحرف التالي مع غنة مقدار حركتين.",
    },
  },
  idgham_wo_ghunnah: {
    en: {
      name: "Merging without ghunnah",
      description:
        "Merge the nūn or tanwīn completely into the following letter without a nasal sound.",
    },
    ar: {
      name: "الإدغام بغير غنة",
      description: "تُدغم النون أو التنوين في الحرف التالي من غير غنة.",
    },
  },
  idgham_shafawi: {
    en: {
      name: "Labial merging",
      description:
        "Merge the still mīm into the following mīm with a two-count ghunnah.",
    },
    ar: {
      name: "الإدغام الشفوي",
      description: "تُدغم الميم الساكنة في الميم بعدها مع غنة مقدار حركتين.",
    },
  },
  iqlab: {
    en: {
      name: "Conversion",
      description:
        "Change the nūn or tanwīn into a concealed mīm before bāʾ, with ghunnah.",
    },
    ar: {
      name: "الإقلاب",
      description: "تُقلب النون أو التنوين ميمًا مخفاة عند الباء مع الغنة.",
    },
  },
  slnt: {
    en: {
      name: "Silent letter",
      description:
        "This marked letter is written but not pronounced while joining the recitation.",
    },
    ar: {
      name: "حرف لا يُنطق",
      description: "هذا الحرف مكتوب، لكنه لا يُنطق عند وصل القراءة.",
    },
  },
};

const RULE_PRIORITY: TajweedRuleId[] = [
  "idgham_ghunnah",
  "idgham_wo_ghunnah",
  "idgham_shafawi",
  "iqlab",
  "ikhafa",
  "ikhafa_shafawi",
  "ghunnah",
  "qalaqah",
  "madda_necessary",
  "madda_obligatory_mottasel",
  "madda_obligatory_monfasel",
  "madda_permissible",
  "laam_shamsiyah",
  "ham_wasl",
  "slnt",
  "madda_normal",
];

const RULE_RANK = new Map(
  RULE_PRIORITY.map((rule, index) => [rule, index] as const),
);

export function prioritizeTajweedRules(
  rules: TajweedRuleId[],
): TajweedRuleId[] {
  return [...rules].sort(
    (left, right) =>
      (RULE_RANK.get(left) ?? RULE_PRIORITY.length) -
      (RULE_RANK.get(right) ?? RULE_PRIORITY.length),
  );
}

export function tajweedRuleCopy(
  rule: TajweedRuleId,
  language: Language,
): TajweedRuleCopy {
  return COPY[rule][language];
}
