import { accuracy, buildQuizChoices, type QuizChoice } from "./quiz.ts";
import { quizStepAfterAudio } from "./session.ts";
import { activeWordPosition } from "./timing.ts";
import { batchChapters } from "./batching.ts";
import { memorizationWords } from "./memorization.ts";
import { decodePracticeLink, encodePracticeLink, type MemorizationLevel } from "./practice-link.ts";
import {
  recordTransition,
  transitionKey,
  weakestTransitions,
  type TransitionScores,
} from "./adaptive.ts";

interface Chapter {
  id: number;
  nameSimple: string;
  nameArabic: string;
  versesCount: number;
}

interface Reciter {
  id: number;
  nameEnglish: string;
  nameArabic: string;
  style: string | null;
}

interface TafsirResource {
  id: number;
  nameEnglish: string;
  nameArabic: string;
  languageName: string;
}

interface Verse {
  verseKey: string;
  chapterId: number;
  arabic: string;
  translation: string;
  audioUrl: string;
  words?: Array<{ position: number; text: string }>;
  wordTimings?: Array<{ position: number; startMs: number; endMs: number }>;
}

interface SessionGroup {
  chapter: Chapter;
  verses: Verse[];
}

type Language = "en" | "ar";

const messages: Record<Language, Record<string, string>> = {
  en: {
    brandName: "Quran Memo",
    brandTagline: "Listen. Repeat. Remember.",
    heroEyebrow: "A calmer way to memorize",
    heroLineOne: "Let every surah",
    heroLineTwo: "settle in.",
    heroDescription: "Select complete surahs, choose a reciter, and let focused repetition do the rest.",
    practiceSettings: "Practice settings",
    practiceDescription: "Shape your listening session.",
    reciter: "Reciter",
    chooseReciter: "Choose a reciter",
    searchReciters: "Search reciters…",
    surahRepeats: "Surah repeats",
    ayahRepeats: "Ayah repeats",
    fullCycles: "Full cycles",
    oneCycle: "1 cycle",
    twoCycles: "2 cycles",
    threeCycles: "3 cycles",
    fiveCycles: "5 cycles",
    forever: "Forever",
    pauseBetween: "Pause between surah repeats",
    pauseAfterAyah: "Pause after each ayah",
    memorizationMode: "Memorization display",
    memoryFull: "Full ayah",
    memoryFirstWords: "First 3 words",
    memoryInitials: "Word initials",
    memoryHidden: "Hidden",
    surahsSelected: "surahs selected",
    clear: "Clear",
    beginListening: "Begin listening",
    testMemory: "Test my memory",
    completeSurah: "Complete the surah",
    chooseSurahs: "Choose surahs",
    chooseDescription: "Pick one or build a longer set.",
    searchSurahs: "Search Arabic, English, or number…",
    selectVisible: "Select visible",
    loadingCatalog: "Loading Quran catalog…",
    loadingReciters: "Loading reciters…",
    catalogFailed: "The Quran catalog could not be loaded. Please try again.",
    changeSession: "Change session",
    whichNext: "Which ayah comes next?",
    sessionComplete: "Session complete",
    accuracyTitle: "Your memorization accuracy",
    retryQuiz: "Try this quiz again",
    nowPlaying: "Now playing",
    surahRepeat: "Surah repeat",
    selectionCycle: "Selection cycle",
    quizScore: "Quiz score",
    contentCredit: "Quran content and audio from Quran.com",
    ayahs: "ayahs",
    more: "+{count} more",
    chooseAReciter: "Choose a reciter",
    loadingAudio: "Loading audio…",
    playbackFailed: "Playback could not start.",
    playingAyah: "Playing ayah {key}",
    sessionFinished: "Session complete. May Allah make it beneficial.",
    repeatingIn: "Repeating this surah in {seconds}s…",
    repeating: "Repeating this surah…",
    chooseNext: "Choose the ayah that comes next.",
    correct: "Correct — keep going.",
    correctAnswer: "The correct answer is {key}.",
    quizFinished: "Quiz complete.",
    quizDetail: "You answered {correct} of {total} correctly.",
    quizToast: "Quiz complete · {percent}% accuracy",
    preparing: "Preparing…",
    surahNumber: "Surah {number}",
    ayahProgress: "Ayah {current} of {total}",
    surahName: "Surah {name}",
    play: "Play",
    pause: "Pause",
    previousAyah: "Previous ayah",
    nextAyah: "Next ayah",
    closeReciter: "Close reciter picker",
    availableReciters: "Available reciters",
    sessionUnavailable: "This session could not be prepared. Please try again.",
    copyPracticeLink: "Copy practice link",
    shareSession: "Share session",
    linkCopied: "Practice link copied.",
    translation: "Translation",
    tafsir: "Tafsir",
    chooseTafsir: "Choose a Tafsir source to read its explanation.",
    loadingTafsir: "Loading Tafsir…",
    tafsirUnavailable: "Tafsir could not be loaded.",
    adaptiveReview: "Adaptive review",
    ayahRepeatStatus: "Ayah repeat {current} / {total}",
    hiddenAyah: "Ayah hidden — listen and recite from memory",
  },
  ar: {
    brandName: "حفظ القرآن",
    brandTagline: "استمع، كرر، واحفظ",
    heroEyebrow: "طريقة هادئة للحفظ",
    heroLineOne: "دع كل سورة",
    heroLineTwo: "تستقر في قلبك.",
    heroDescription: "اختر السور كاملة، وحدد القارئ، ودع التكرار الهادئ يعينك على الحفظ.",
    practiceSettings: "إعدادات المراجعة",
    practiceDescription: "خصص جلسة الاستماع كما تريد.",
    reciter: "القارئ",
    chooseReciter: "اختر القارئ",
    searchReciters: "ابحث عن قارئ…",
    surahRepeats: "تكرار السورة",
    ayahRepeats: "تكرار الآية",
    fullCycles: "دورات المجموعة",
    oneCycle: "دورة واحدة",
    twoCycles: "دورتان",
    threeCycles: "٣ دورات",
    fiveCycles: "٥ دورات",
    forever: "بلا توقف",
    pauseBetween: "التوقف بين تكرارات السورة",
    pauseAfterAyah: "التوقف بعد كل آية",
    memorizationMode: "عرض الحفظ",
    memoryFull: "الآية كاملة",
    memoryFirstWords: "أول ٣ كلمات",
    memoryInitials: "أوائل الكلمات",
    memoryHidden: "إخفاء الآية",
    surahsSelected: "سور مختارة",
    clear: "مسح",
    beginListening: "ابدأ الاستماع",
    testMemory: "اختبر حفظي",
    completeSurah: "أكمل السورة",
    chooseSurahs: "اختر السور",
    chooseDescription: "اختر سورة واحدة أو مجموعة أطول.",
    searchSurahs: "ابحث بالعربية أو الإنجليزية أو الرقم…",
    selectVisible: "تحديد الظاهر",
    loadingCatalog: "جارٍ تحميل فهرس القرآن…",
    loadingReciters: "جارٍ تحميل القراء…",
    catalogFailed: "تعذر تحميل فهرس القرآن. حاول مرة أخرى.",
    changeSession: "تغيير الجلسة",
    whichNext: "ما الآية التالية؟",
    sessionComplete: "اكتملت الجلسة",
    accuracyTitle: "دقة الحفظ",
    retryQuiz: "أعد الاختبار",
    nowPlaying: "يُشغّل الآن",
    surahRepeat: "تكرار السورة",
    selectionCycle: "دورة المجموعة",
    quizScore: "نتيجة الاختبار",
    contentCredit: "محتوى القرآن والصوت من Quran.com",
    ayahs: "آيات",
    more: "+{count} أخرى",
    chooseAReciter: "اختر القارئ",
    loadingAudio: "جارٍ تحميل الصوت…",
    playbackFailed: "تعذر بدء التشغيل.",
    playingAyah: "تشغيل الآية {key}",
    sessionFinished: "اكتملت الجلسة، نفعك الله بها.",
    repeatingIn: "ستُعاد السورة بعد {seconds} ث…",
    repeating: "إعادة السورة…",
    chooseNext: "اختر الآية التي تليها.",
    correct: "إجابة صحيحة، أحسنت.",
    correctAnswer: "الإجابة الصحيحة هي {key}.",
    quizFinished: "اكتمل الاختبار.",
    quizDetail: "أجبت عن {correct} من {total} إجابات صحيحة.",
    quizToast: "اكتمل الاختبار · الدقة {percent}%",
    preparing: "جارٍ التحضير…",
    surahNumber: "سورة {number}",
    ayahProgress: "الآية {current} من {total}",
    surahName: "سورة {name}",
    play: "تشغيل",
    pause: "إيقاف مؤقت",
    previousAyah: "الآية السابقة",
    nextAyah: "الآية التالية",
    closeReciter: "إغلاق قائمة القراء",
    availableReciters: "القراء المتاحون",
    sessionUnavailable: "تعذر تحضير هذه الجلسة. حاول مرة أخرى.",
    copyPracticeLink: "نسخ رابط المراجعة",
    shareSession: "مشاركة الجلسة",
    linkCopied: "تم نسخ رابط المراجعة.",
    translation: "الترجمة",
    tafsir: "التفسير",
    chooseTafsir: "اختر مصدر تفسير لقراءة شرح الآية.",
    loadingTafsir: "جارٍ تحميل التفسير…",
    tafsirUnavailable: "تعذر تحميل التفسير.",
    adaptiveReview: "مراجعة تكيفية",
    ayahRepeatStatus: "تكرار الآية {current} / {total}",
    hiddenAyah: "الآية مخفية — استمع وردد من حفظك",
  },
};

const linkedLanguage = new URLSearchParams(window.location.search).get("lang");
let currentLanguage: Language = linkedLanguage === "ar" || linkedLanguage === "en"
  ? linkedLanguage
  : localStorage.getItem("quran-memo-language") === "ar"
  || (!localStorage.getItem("quran-memo-language") && navigator.language.startsWith("ar"))
  ? "ar"
  : "en";

function t(key: string, values: Record<string, string | number> = {}): string {
  return (messages[currentLanguage][key] ?? messages.en[key] ?? key)
    .replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
}

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const setupView = element<HTMLElement>("setup-view");
const playerView = element<HTMLElement>("player-view");
const reciterSelect = element<HTMLSelectElement>("reciter-select");
const reciterPicker = element<HTMLElement>("reciter-picker");
const reciterTrigger = element<HTMLButtonElement>("reciter-trigger");
const reciterMenu = element<HTMLElement>("reciter-menu");
const reciterSearch = element<HTMLInputElement>("reciter-search");
const reciterOptions = element<HTMLElement>("reciter-options");
const repeatInput = element<HTMLInputElement>("repeat-input");
const ayahRepeatInput = element<HTMLInputElement>("ayah-repeat-input");
const cyclesSelect = element<HTMLSelectElement>("cycles-select");
const delayInput = element<HTMLInputElement>("delay-input");
const delayValue = element<HTMLElement>("delay-value");
const ayahDelayInput = element<HTMLInputElement>("ayah-delay-input");
const ayahDelayValue = element<HTMLElement>("ayah-delay-value");
const memorizationSelect = element<HTMLSelectElement>("memorization-select");
const searchInput = element<HTMLInputElement>("surah-search");
const surahList = element<HTMLElement>("surah-list");
const selectedCount = element<HTMLElement>("selected-count");
const selectedChips = element<HTMLElement>("selected-chips");
const startButton = element<HTMLButtonElement>("start-button");
const quizButton = element<HTMLButtonElement>("quiz-button");
const clearButton = element<HTMLButtonElement>("clear-button");
const selectVisibleButton = element<HTMLButtonElement>("select-visible-button");
const shareButton = element<HTMLButtonElement>("share-button");
const catalogLoading = element<HTMLElement>("catalog-loading");
const audio = element<HTMLAudioElement>("audio-player");
const playButton = element<HTMLButtonElement>("play-button");
const playbackMessage = element<HTMLElement>("playback-message");
const toast = element<HTMLElement>("toast");
const quizPanel = element<HTMLElement>("quiz-panel");
const quizOptions = element<HTMLElement>("quiz-options");
const quizResult = element<HTMLElement>("quiz-result");

interface CustomSelectController {
  root: HTMLElement;
  refresh(): void;
  close(): void;
}

const customSelectControllers = new Map<HTMLSelectElement, CustomSelectController>();

function enhanceSelect(select: HTMLSelectElement): CustomSelectController {
  const root = document.createElement("div");
  root.className = "custom-select";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "custom-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", select.getAttribute("aria-label") ?? select.id);
  const value = document.createElement("span");
  value.className = "custom-select-value";
  const chevron = document.createElement("i");
  chevron.className = "custom-select-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = "⌄";
  trigger.append(value, chevron);

  const menu = document.createElement("div");
  menu.className = "custom-select-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  root.append(trigger, menu);
  select.after(root);
  select.hidden = true;

  const close = () => {
    menu.hidden = true;
    root.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
  };
  const refresh = () => {
    const selected = select.selectedOptions[0];
    value.textContent = selected?.textContent?.trim() || "—";
    menu.replaceChildren();
    for (const option of select.options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `custom-select-option${option.selected ? " selected" : ""}`;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(option.selected));
      const marker = document.createElement("span");
      marker.className = "custom-select-marker";
      marker.textContent = option.selected ? "✓" : "";
      const label = document.createElement("span");
      label.textContent = option.textContent;
      button.append(marker, label);
      button.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        refresh();
        close();
        trigger.focus();
      });
      menu.append(button);
    }
  };
  const open = () => {
    for (const controller of customSelectControllers.values()) controller.close();
    closeReciterMenu();
    refresh();
    menu.hidden = false;
    root.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
  };

  trigger.addEventListener("click", () => menu.hidden ? open() : close());
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      open();
      menu.querySelector<HTMLButtonElement>(".custom-select-option.selected, .custom-select-option")?.focus();
    }
  });
  select.addEventListener("change", refresh);
  refresh();
  return { root, refresh, close };
}

for (const select of [cyclesSelect, memorizationSelect, element<HTMLSelectElement>("tafsir-select")]) {
  customSelectControllers.set(select, enhanceSelect(select));
}

function refreshCustomSelect(select: HTMLSelectElement): void {
  customSelectControllers.get(select)?.refresh();
}

let chapters: Chapter[] = [];
let reciters: Reciter[] = [];
let tafsirs: TafsirResource[] = [];
let visibleChapters: Chapter[] = [];
const selectedIds = new Set<number>();
let session: SessionGroup[] = [];
let surahIndex = 0;
let verseIndex = 0;
let surahRepeat = 1;
let ayahRepeat = 1;
let cycle = 1;
let sessionRepeats = 3;
let sessionCycles: number | "forever" = 1;
let delaySeconds = 0;
let ayahDelaySeconds = 0;
let ayahRepeats = 1;
let memorizationLevel: MemorizationLevel = "full";
let isPlaying = false;
let delayTimer: number | undefined;
let mode: "practice" | "quiz" = "practice";
let quizPool: QuizChoice[] = [];
let quizCorrect = 0;
let quizTotal = 0;
let highlightFrame: number | undefined;
let transitionScores: TransitionScores = loadTransitionScores();
let quizReviewQueue: Array<{ surahIndex: number; verseIndex: number }> = [];
let quizInReview = false;
let tafsirRequest = 0;
let lastRenderedVerseKey = "";

function loadTransitionScores(): TransitionScores {
  try {
    const parsed = JSON.parse(localStorage.getItem("quran-memo-transition-scores") ?? "{}");
    return parsed && typeof parsed === "object" ? parsed as TransitionScores : {};
  } catch {
    return {};
  }
}

function showToast(message: string, error = false): void {
  toast.textContent = message;
  toast.className = `toast visible${error ? " error" : ""}`;
  window.setTimeout(() => toast.classList.remove("visible"), 4_000);
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Request failed with HTTP ${response.status}`);
  return data;
}

function reciterLabel(reciter: Reciter): string {
  const style = localizedStyle(reciter.style);
  return currentLanguage === "ar"
    ? `${reciter.nameArabic} · ${style} — ${reciter.nameEnglish}`
    : `${reciter.nameEnglish} — ${style} · ${reciter.nameArabic}`;
}

function localizedStyle(style: string | null): string {
  const actual = style ?? "Murattal";
  if (currentLanguage !== "ar") return actual;
  return ({ Murattal: "مرتل", Mujawwad: "مجود", Muallim: "معلم" } as Record<string, string>)[actual] ?? actual;
}

function selectedReciter(): Reciter | undefined {
  return reciters.find((reciter) => reciter.id === Number(reciterSelect.value));
}

function updateReciterTrigger(): void {
  const reciter = selectedReciter();
  element("reciter-trigger-name").textContent = reciter
    ? currentLanguage === "ar" ? reciter.nameArabic : reciter.nameEnglish
    : t("chooseAReciter");
  element("reciter-trigger-detail").textContent = reciter
    ? currentLanguage === "ar"
      ? `${localizedStyle(reciter.style)} · ${reciter.nameEnglish}`
      : `${localizedStyle(reciter.style)} · ${reciter.nameArabic}`
    : "";
}

function renderReciterOptions(): void {
  const filter = reciterSearch.value.trim().toLocaleLowerCase();
  const selectedId = Number(reciterSelect.value);
  reciterOptions.replaceChildren();
  for (const reciter of reciters.filter((item) =>
    !filter
    || item.nameEnglish.toLocaleLowerCase().includes(filter)
    || item.nameArabic.includes(filter)
    || item.style?.toLocaleLowerCase().includes(filter)
  )) {
    const selected = reciter.id === selectedId;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `reciter-option${selected ? " selected" : ""}`;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(selected));
    const primaryName = currentLanguage === "ar" ? reciter.nameArabic : reciter.nameEnglish;
    const secondaryName = currentLanguage === "ar" ? reciter.nameEnglish : reciter.nameArabic;
    button.innerHTML = `
      <span class="reciter-option-radio" aria-hidden="true">${selected ? "✓" : ""}</span>
      <span class="reciter-option-copy"><b>${primaryName}</b><small>${secondaryName}</small></span>
      <span class="reciter-style">${localizedStyle(reciter.style)}</span>
    `;
    button.addEventListener("click", () => {
      reciterSelect.value = String(reciter.id);
      updateReciterTrigger();
      renderReciterOptions();
      closeReciterMenu();
      reciterTrigger.focus();
    });
    reciterOptions.append(button);
  }
}

function openReciterMenu(): void {
  reciterMenu.hidden = false;
  reciterTrigger.setAttribute("aria-expanded", "true");
  reciterPicker.classList.add("open");
  reciterSearch.value = "";
  renderReciterOptions();
  window.setTimeout(() => reciterSearch.focus(), 0);
}

function closeReciterMenu(): void {
  reciterMenu.hidden = true;
  reciterTrigger.setAttribute("aria-expanded", "false");
  reciterPicker.classList.remove("open");
}

function applyLanguage(language: Language): void {
  currentLanguage = language;
  localStorage.setItem("quran-memo-language", language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.title = language === "ar" ? "حفظ القرآن" : "Quran Memo";
  for (const node of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n!);
  }
  for (const input of document.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]")) {
    input.placeholder = t(input.dataset.i18nPlaceholder!);
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-language]")) {
    button.setAttribute("aria-pressed", String(button.dataset.language === language));
  }
  element("reciter-close").setAttribute("aria-label", t("closeReciter"));
  reciterOptions.setAttribute("aria-label", t("availableReciters"));
  element("previous-button").setAttribute("aria-label", t("previousAyah"));
  element("next-button").setAttribute("aria-label", t("nextAyah"));
  playButton.setAttribute("aria-label", t(isPlaying ? "pause" : "play"));
  delayValue.textContent = language === "ar" ? `${delayInput.value} ث` : `${delayInput.value}s`;
  ayahDelayValue.textContent = language === "ar" ? `${ayahDelayInput.value} ث` : `${ayahDelayInput.value}s`;
  if (reciters.length) {
    updateReciterTrigger();
    renderReciterOptions();
  }
  if (tafsirs.length) renderTafsirOptions(true);
  refreshCustomSelect(cyclesSelect);
  refreshCustomSelect(memorizationSelect);
  if (chapters.length) {
    renderSurahs();
    renderSelection();
  }
  const activeGroup = session[surahIndex];
  if (activeGroup?.verses[verseIndex]) updatePlayerView();
}

function renderTafsirOptions(preferLanguage = false): void {
  const tafsirSelect = element<HTMLSelectElement>("tafsir-select");
  const selectedId = Number(tafsirSelect.value);
  const preferredLanguage = currentLanguage === "ar" ? "arabic" : "english";
  const localized = tafsirs.filter((tafsir) => tafsir.languageName.toLowerCase() === preferredLanguage);
  const ordered = localized.length ? localized : tafsirs;
  tafsirSelect.replaceChildren();
  for (const tafsir of ordered) {
    const option = document.createElement("option");
    option.value = String(tafsir.id);
    option.textContent = currentLanguage === "ar" ? tafsir.nameArabic : tafsir.nameEnglish;
    tafsirSelect.append(option);
  }
  const selected = tafsirs.find((tafsir) => tafsir.id === selectedId);
  if (!preferLanguage && selected) tafsirSelect.value = String(selected.id);
  else {
    const preferred = ordered.find((tafsir) => tafsir.languageName.toLowerCase() === preferredLanguage);
    if (preferred) tafsirSelect.value = String(preferred.id);
  }
  const active = tafsirs.find((tafsir) => tafsir.id === Number(tafsirSelect.value));
  const arabic = active?.languageName.toLowerCase() === "arabic";
  element("tafsir-text").setAttribute("dir", arabic ? "rtl" : "ltr");
  element("tafsir-text").setAttribute("lang", arabic ? "ar" : "en");
  refreshCustomSelect(tafsirSelect);
}

function currentSharedPractice() {
  return {
    surahIds: [...selectedIds],
    reciterId: Number(reciterSelect.value) || 6,
    ayahRepeats: Math.min(100, Math.max(1, Number(ayahRepeatInput.value) || 1)),
    surahRepeats: Math.min(100, Math.max(1, Number(repeatInput.value) || 3)),
    cycles: cyclesSelect.value === "forever" ? "forever" as const : Math.max(1, Number(cyclesSelect.value) || 1),
    ayahDelay: Number(ayahDelayInput.value),
    surahDelay: Number(delayInput.value),
    memorization: memorizationSelect.value as MemorizationLevel,
    language: currentLanguage,
  };
}

function practiceUrl(): string {
  const url = new URL(window.location.href);
  url.search = encodePracticeLink(currentSharedPractice()).toString();
  return url.toString();
}

async function copyPracticeLink(): Promise<void> {
  const url = practiceUrl();
  history.replaceState(null, "", url);
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const input = document.createElement("input");
    input.value = url;
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  showToast(t("linkCopied"));
}

function restoreSharedPractice(): void {
  const shared = decodePracticeLink(new URLSearchParams(window.location.search));
  if (shared.language) currentLanguage = shared.language;
  for (const id of shared.surahIds ?? []) selectedIds.add(id);
  if (shared.reciterId && reciters.some((reciter) => reciter.id === shared.reciterId)) {
    reciterSelect.value = String(shared.reciterId);
  }
  if (shared.ayahRepeats) ayahRepeatInput.value = String(shared.ayahRepeats);
  if (shared.surahRepeats) repeatInput.value = String(shared.surahRepeats);
  if (shared.cycles) cyclesSelect.value = String(shared.cycles);
  if (shared.ayahDelay !== undefined) ayahDelayInput.value = String(shared.ayahDelay);
  if (shared.surahDelay !== undefined) delayInput.value = String(shared.surahDelay);
  if (shared.memorization) memorizationSelect.value = shared.memorization;
  applyLanguage(currentLanguage);
  renderSelection();
}

async function loadCatalog(): Promise<void> {
  try {
    const catalog = await getJson<{
      chapters: Chapter[];
      reciters: Reciter[];
      tafsirs: Array<TafsirResource & { name?: string }>;
      defaultReciterId: number;
    }>("/api/catalog");
    chapters = catalog.chapters;
    reciters = catalog.reciters;
    tafsirs = (catalog.tafsirs ?? []).flatMap((tafsir) => {
      const fallbackName = tafsir.nameEnglish || tafsir.nameArabic || tafsir.name;
      if (!fallbackName || !Number.isInteger(tafsir.id)) return [];
      return [{
        id: tafsir.id,
        nameEnglish: tafsir.nameEnglish || fallbackName,
        nameArabic: tafsir.nameArabic || fallbackName,
        languageName: tafsir.languageName || "unknown",
      }];
    });
    for (const reciter of reciters) {
      const option = document.createElement("option");
      option.value = String(reciter.id);
      option.textContent = reciterLabel(reciter);
      option.selected = reciter.id === catalog.defaultReciterId;
      reciterSelect.append(option);
    }
    restoreSharedPractice();
    updateReciterTrigger();
    renderReciterOptions();
    catalogLoading.hidden = true;
    renderSurahs();
  } catch (error) {
    console.error(error);
    catalogLoading.textContent = t("catalogFailed");
    catalogLoading.classList.add("error");
  }
}

function currentFilter(): string {
  return searchInput.value.trim().toLocaleLowerCase();
}

function renderSurahs(): void {
  const filter = currentFilter();
  visibleChapters = chapters.filter((chapter) =>
    !filter
    || String(chapter.id).includes(filter)
    || chapter.nameSimple.toLocaleLowerCase().includes(filter)
    || chapter.nameArabic.includes(filter)
  );
  surahList.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const chapter of visibleChapters) {
    const selected = selectedIds.has(chapter.id);
    const primaryName = currentLanguage === "ar" ? chapter.nameArabic : chapter.nameSimple;
    const secondaryName = currentLanguage === "ar" ? chapter.nameSimple : chapter.nameArabic;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `surah-card${selected ? " selected" : ""}`;
    button.setAttribute("role", "checkbox");
    button.setAttribute("aria-checked", String(selected));
    button.innerHTML = `
      <span class="surah-check" aria-hidden="true">${selected ? "✓" : ""}</span>
      <span class="surah-number">${String(chapter.id).padStart(3, "0")}</span>
      <span class="surah-names"><b>${primaryName}</b><small>${chapter.versesCount} ${t("ayahs")}</small></span>
      <strong class="surah-arabic" translate="no">${secondaryName}</strong>
    `;
    button.addEventListener("click", () => {
      selected ? selectedIds.delete(chapter.id) : selectedIds.add(chapter.id);
      renderSurahs();
      renderSelection();
    });
    fragment.append(button);
  }
  surahList.append(fragment);
}

function renderSelection(): void {
  const selected = chapters.filter((chapter) => selectedIds.has(chapter.id));
  selectedCount.textContent = String(selected.length);
  startButton.disabled = selected.length === 0;
  quizButton.disabled = selected.length === 0;
  clearButton.disabled = selected.length === 0;
  shareButton.disabled = selected.length === 0;
  selectedChips.replaceChildren();
  for (const chapter of selected.slice(0, 5)) {
    const chip = document.createElement("span");
    chip.textContent = currentLanguage === "ar" ? chapter.nameArabic : chapter.nameSimple;
    selectedChips.append(chip);
  }
  if (selected.length > 5) {
    const more = document.createElement("span");
    more.textContent = t("more", { count: selected.length - 5 });
    selectedChips.append(more);
  }
}

function currentGroup(): SessionGroup {
  return session[surahIndex]!;
}

function currentVerse(): Verse {
  return currentGroup().verses[verseIndex]!;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function renderArabicVerse(verse: Verse): void {
  const container = element<HTMLElement>("player-arabic");
  container.replaceChildren();
  container.classList.toggle("hidden-memory", memorizationLevel === "hidden");
  if (!verse.words?.length) {
    container.textContent = memorizationLevel === "hidden" ? t("hiddenAyah") : verse.arabic;
    return;
  }
  const displayed = memorizationWords(verse.words, memorizationLevel);
  if (displayed.length === 0) {
    container.textContent = t("hiddenAyah");
    return;
  }
  for (const word of displayed) {
    const span = document.createElement("span");
    span.className = "arabic-word";
    span.dataset.position = String(word.position);
    span.textContent = word.text;
    container.append(span, document.createTextNode(" "));
  }
}

function syncWordHighlight(): void {
  const verse = session[surahIndex]?.verses[verseIndex];
  const milliseconds = audio.currentTime * 1_000;
  const activePosition = activeWordPosition(verse?.wordTimings ?? [], milliseconds);
  for (const word of element<HTMLElement>("player-arabic").querySelectorAll<HTMLElement>(".arabic-word")) {
    word.classList.toggle("active", Number(word.dataset.position) === activePosition);
  }
}

function syncTimeline(): void {
  const percent = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  element<HTMLElement>("timeline-progress").style.width = `${percent}%`;
  element("elapsed-time").textContent = formatTime(audio.currentTime);
  element("duration-time").textContent = formatTime(audio.duration);
  syncWordHighlight();
}

function animatePlayback(): void {
  syncTimeline();
}

async function announceSurahName(chapter: Chapter): Promise<void> {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
  window.speechSynthesis.cancel();
  await new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(`سورة ${chapter.nameArabic}`);
    utterance.lang = "ar-SA";
    utterance.rate = 0.82;
    utterance.pitch = 0.95;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(done, 4_000);
    utterance.onend = done;
    utterance.onerror = done;
    window.speechSynthesis.speak(utterance);
  });
}

function updatePlayerView(): void {
  const group = currentGroup();
  const verse = currentVerse();
  const verseChanged = verse.verseKey !== lastRenderedVerseKey;
  lastRenderedVerseKey = verse.verseKey;
  element("player-surah-number").textContent = t("surahNumber", { number: group.chapter.id });
  element("player-progress-label").textContent = t("ayahProgress", { current: verseIndex + 1, total: group.verses.length });
  element("player-surah-english").textContent = group.chapter.nameSimple;
  element("player-surah-arabic").textContent = group.chapter.nameArabic;
  element("player-verse-key").textContent = verse.verseKey;
  renderArabicVerse(verse);
  element("player-translation").textContent = verse.translation;
  element("now-playing-title").textContent = currentLanguage === "ar" ? group.chapter.nameArabic : group.chapter.nameSimple;
  const reciter = reciters.find((item) => item.id === Number(reciterSelect.value));
  element("now-playing-reciter").textContent = reciter
    ? currentLanguage === "ar"
      ? `${reciter.nameArabic}${reciter.style ? ` — ${localizedStyle(reciter.style)}` : ""}`
      : `${reciter.nameEnglish}${reciter.style ? ` — ${localizedStyle(reciter.style)}` : ""}`
    : "";
  element("surah-repeat-status").textContent = `${surahRepeat} / ${sessionRepeats}`;
  element("ayah-repeat-status").textContent = `${ayahRepeat} / ${ayahRepeats}`;
  element("cycle-status").textContent = `${cycle} / ${sessionCycles === "forever" ? "∞" : sessionCycles}`;
  if (verseChanged) {
    const verseContent = element<HTMLElement>("player-verse-content");
    verseContent.classList.remove("verse-changing");
    void verseContent.offsetWidth;
    verseContent.classList.add("verse-changing");
  }
  if (!element<HTMLElement>("tafsir-pane").hidden) void loadCurrentTafsir();
}

async function loadCurrentTafsir(): Promise<void> {
  const tafsirId = Number(element<HTMLSelectElement>("tafsir-select").value);
  const verse = session[surahIndex]?.verses[verseIndex];
  if (!tafsirId || !verse) {
    element("tafsir-text").textContent = t("chooseTafsir");
    return;
  }
  const requestId = ++tafsirRequest;
  element("tafsir-text").textContent = t("loadingTafsir");
  try {
    const result = await getJson<{ text: string }>(
      `/api/tafsir?tafsir=${tafsirId}&verse=${encodeURIComponent(verse.verseKey)}`,
    );
    if (requestId === tafsirRequest && currentVerse().verseKey === verse.verseKey) {
      element("tafsir-text").textContent = result.text;
    }
  } catch (error) {
    console.error(error);
    if (requestId === tafsirRequest) element("tafsir-text").textContent = t("tafsirUnavailable");
  }
}

function showStudyTab(tab: "translation" | "tafsir"): void {
  const translation = tab === "translation";
  element<HTMLButtonElement>("translation-tab").setAttribute("aria-selected", String(translation));
  element<HTMLButtonElement>("tafsir-tab").setAttribute("aria-selected", String(!translation));
  element<HTMLElement>("translation-pane").hidden = !translation;
  element<HTMLElement>("tafsir-pane").hidden = translation;
  if (!translation) void loadCurrentTafsir();
}

async function playCurrent(announce = false): Promise<void> {
  window.clearTimeout(delayTimer);
  quizPanel.hidden = true;
  quizResult.hidden = true;
  updatePlayerView();
  const verse = currentVerse();
  if (announce) {
    const chapter = currentGroup().chapter;
    playbackMessage.textContent = t("surahName", {
      name: currentLanguage === "ar" ? chapter.nameArabic : chapter.nameSimple,
    });
    await announceSurahName(currentGroup().chapter);
  }
  playbackMessage.textContent = t("loadingAudio");
  audio.src = verse.audioUrl;
  audio.load();
  try {
    await audio.play();
    isPlaying = true;
    playButton.textContent = "Ⅱ";
    playButton.setAttribute("aria-label", t("pause"));
    playbackMessage.textContent = t("playingAyah", { key: verse.verseKey });
    animatePlayback();
  } catch (error) {
    isPlaying = false;
    playButton.textContent = "▶";
    playButton.setAttribute("aria-label", t("play"));
    playbackMessage.textContent = t("playbackFailed");
    console.error(error);
    showToast(t("playbackFailed"), true);
  }
}

function sessionComplete(): void {
  isPlaying = false;
  playButton.textContent = "▶";
  playButton.setAttribute("aria-label", t("play"));
  playbackMessage.textContent = t("sessionFinished");
  showToast(t("sessionComplete"));
}

function advance(): void {
  if (ayahRepeat < ayahRepeats) {
    ayahRepeat += 1;
    element("ayah-repeat-status").textContent = `${ayahRepeat} / ${ayahRepeats}`;
    playbackMessage.textContent = t("ayahRepeatStatus", { current: ayahRepeat, total: ayahRepeats });
    delayTimer = window.setTimeout(() => void playCurrent(), ayahDelaySeconds * 1_000);
    return;
  }
  ayahRepeat = 1;
  verseIndex += 1;
  if (verseIndex < currentGroup().verses.length) {
    delayTimer = window.setTimeout(() => void playCurrent(), ayahDelaySeconds * 1_000);
    return;
  }

  verseIndex = 0;
  if (surahRepeat < sessionRepeats) {
    surahRepeat += 1;
    updatePlayerView();
    playbackMessage.textContent = delaySeconds > 0
      ? t("repeatingIn", { seconds: delaySeconds })
      : t("repeating");
    delayTimer = window.setTimeout(() => void playCurrent(), delaySeconds * 1_000);
    return;
  }

  surahRepeat = 1;
  surahIndex += 1;
  if (surahIndex < session.length) {
    void playCurrent(true);
    return;
  }

  surahIndex = 0;
  if (sessionCycles === "forever" || cycle < sessionCycles) {
    cycle += 1;
    void playCurrent(true);
  } else {
    sessionComplete();
  }
}

function previous(): void {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (verseIndex > 0) verseIndex -= 1;
  else if (surahIndex > 0) {
    surahIndex -= 1;
    verseIndex = currentGroup().verses.length - 1;
    surahRepeat = 1;
  }
  ayahRepeat = 1;
  void playCurrent();
}

function updateQuizScore(): void {
  element("quiz-live-score").textContent = `${quizCorrect} / ${quizTotal}`;
}

function allSessionTransitions(): Array<{ key: string; surahIndex: number; verseIndex: number }> {
  return session.flatMap((group, groupIndex) => group.verses.slice(0, -1).map((verse, index) => ({
    key: transitionKey(verse.verseKey, group.verses[index + 1]!.verseKey),
    surahIndex: groupIndex,
    verseIndex: index,
  })));
}

function prepareAdaptiveReview(): void {
  quizReviewQueue = weakestTransitions(allSessionTransitions(), transitionScores)
    .map(({ surahIndex: groupIndex, verseIndex: index }) => ({ surahIndex: groupIndex, verseIndex: index }));
  quizInReview = false;
}

function playNextAdaptiveReview(): boolean {
  const next = quizReviewQueue.shift();
  if (!next) return false;
  quizInReview = true;
  surahIndex = next.surahIndex;
  verseIndex = next.verseIndex;
  playbackMessage.textContent = t("adaptiveReview");
  void playCurrent();
  return true;
}

function showQuizQuestion(): void {
  isPlaying = false;
  playButton.textContent = "▶";
  playbackMessage.textContent = t("chooseNext");
  const correctVerse = currentGroup().verses[verseIndex + 1]!;
  const choices = buildQuizChoices(
    { verseKey: correctVerse.verseKey, arabic: correctVerse.arabic },
    quizPool,
  );
  quizOptions.replaceChildren();
  quizPanel.hidden = false;
  for (const choice of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-option";
    button.dir = "rtl";
    button.lang = "ar";
    button.textContent = choice.arabic;
    button.addEventListener("click", () => {
      const correct = choice.verseKey === correctVerse.verseKey;
      const key = transitionKey(currentVerse().verseKey, correctVerse.verseKey);
      transitionScores = recordTransition(transitionScores, key, correct);
      localStorage.setItem("quran-memo-transition-scores", JSON.stringify(transitionScores));
      if (!correct && !quizInReview && !quizReviewQueue.some((item) =>
        item.surahIndex === surahIndex && item.verseIndex === verseIndex
      )) {
        quizReviewQueue.push({ surahIndex, verseIndex });
      }
      quizTotal += 1;
      if (correct) quizCorrect += 1;
      updateQuizScore();
      for (const option of quizOptions.querySelectorAll<HTMLButtonElement>(".quiz-option")) {
        option.disabled = true;
        const optionChoice = choices[[...quizOptions.children].indexOf(option)];
        if (optionChoice?.verseKey === correctVerse.verseKey) option.classList.add("correct");
      }
      if (!correct) button.classList.add("wrong");
      playbackMessage.textContent = correct
        ? t("correct")
        : t("correctAnswer", { key: correctVerse.verseKey });
      window.setTimeout(() => {
        quizPanel.hidden = true;
        if (quizInReview) {
          if (!playNextAdaptiveReview()) finishQuiz();
        } else {
          verseIndex += 1;
          void playCurrent();
        }
      }, 1_050);
    });
    quizOptions.append(button);
  }
}

function finishQuiz(): void {
  isPlaying = false;
  quizPanel.hidden = true;
  quizResult.hidden = false;
  playButton.textContent = "▶";
  const percent = accuracy(quizCorrect, quizTotal);
  element("quiz-result-percent").textContent = `${percent}%`;
  element("quiz-result-detail").textContent = t("quizDetail", { correct: quizCorrect, total: quizTotal });
  playbackMessage.textContent = t("quizFinished");
  showToast(t("quizToast", { percent }));
}

function handleQuizAudioEnded(): void {
  if (quizInReview) {
    showQuizQuestion();
    return;
  }
  const step = quizStepAfterAudio(
    surahIndex,
    verseIndex,
    currentGroup().verses.length,
    session.length,
  );
  if (step.action === "question") {
    showQuizQuestion();
    return;
  }
  if (step.action === "next-surah") {
    surahIndex = step.surahIndex;
    verseIndex = step.verseIndex;
    void playCurrent(true);
  } else {
    if (!playNextAdaptiveReview()) finishQuiz();
  }
}

function restartQuiz(): void {
  quizCorrect = 0;
  quizTotal = 0;
  surahIndex = 0;
  verseIndex = 0;
  prepareAdaptiveReview();
  updateQuizScore();
  quizResult.hidden = true;
  void playCurrent(true);
}

async function startSession(selectedMode: "practice" | "quiz"): Promise<void> {
  const selected = chapters.filter((chapter) => selectedIds.has(chapter.id));
  if (selected.length === 0) return;
  mode = selectedMode;
  sessionRepeats = Math.min(100, Math.max(1, Number(repeatInput.value) || 3));
  ayahRepeats = Math.min(100, Math.max(1, Number(ayahRepeatInput.value) || 1));
  sessionCycles = cyclesSelect.value === "forever" ? "forever" : Number(cyclesSelect.value);
  delaySeconds = Number(delayInput.value);
  ayahDelaySeconds = Number(ayahDelayInput.value);
  memorizationLevel = memorizationSelect.value as MemorizationLevel;
  startButton.disabled = true;
  quizButton.disabled = true;
  const activeButton = mode === "quiz" ? quizButton : startButton;
  const activeLabel = activeButton.querySelector("span > b, :scope > span") as HTMLElement;
  activeLabel.textContent = t("preparing");
  try {
    const sessionParts = await Promise.all(batchChapters(selected).map((batch) => {
      const params = new URLSearchParams({
        surahs: batch.map((chapter) => chapter.id).join(","),
        reciter: reciterSelect.value,
      });
      return getJson<{ groups: SessionGroup[]; quizPool: QuizChoice[] }>(`/api/session?${params}`);
    }));
    session = sessionParts.flatMap((part) => part.groups);
    if (!session.length) throw new Error(t("sessionUnavailable"));
    quizPool = [...new Map(
      sessionParts.flatMap((part) => part.quizPool).map((choice) => [choice.verseKey, choice]),
    ).values()];
    surahIndex = 0;
    verseIndex = 0;
    surahRepeat = 1;
    ayahRepeat = 1;
    cycle = 1;
    quizCorrect = 0;
    quizTotal = 0;
    prepareAdaptiveReview();
    updateQuizScore();
    element("loop-stat").hidden = mode === "quiz";
    element("quiz-score-card").hidden = mode !== "quiz";
    element<HTMLButtonElement>("next-button").disabled = mode === "quiz";
    element<HTMLButtonElement>("previous-button").disabled = mode === "quiz";
    setupView.hidden = true;
    playerView.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    await playCurrent(true);
  } catch (error) {
    console.error(error);
    showToast(t("sessionUnavailable"), true);
  } finally {
    startButton.disabled = selectedIds.size === 0;
    quizButton.disabled = selectedIds.size === 0;
    activeLabel.textContent = mode === "quiz" ? t("testMemory") : t("beginListening");
  }
}

searchInput.addEventListener("input", renderSurahs);
reciterTrigger.addEventListener("click", () => reciterMenu.hidden ? openReciterMenu() : closeReciterMenu());
reciterSearch.addEventListener("input", renderReciterOptions);
element("reciter-close").addEventListener("click", () => { closeReciterMenu(); reciterTrigger.focus(); });
document.addEventListener("pointerdown", (event) => {
  if (!reciterMenu.hidden && !reciterPicker.contains(event.target as Node)) closeReciterMenu();
  for (const controller of customSelectControllers.values()) {
    if (!controller.root.contains(event.target as Node)) controller.close();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !reciterMenu.hidden) {
    closeReciterMenu();
    reciterTrigger.focus();
  }
  if (event.key === "Escape") {
    for (const controller of customSelectControllers.values()) controller.close();
  }
});
delayInput.addEventListener("input", () => {
  delayValue.textContent = currentLanguage === "ar" ? `${delayInput.value} ث` : `${delayInput.value}s`;
});
ayahDelayInput.addEventListener("input", () => {
  ayahDelayValue.textContent = currentLanguage === "ar" ? `${ayahDelayInput.value} ث` : `${ayahDelayInput.value}s`;
});
clearButton.addEventListener("click", () => { selectedIds.clear(); renderSurahs(); renderSelection(); });
selectVisibleButton.addEventListener("click", () => {
  const allSelected = visibleChapters.every((chapter) => selectedIds.has(chapter.id));
  for (const chapter of visibleChapters) allSelected ? selectedIds.delete(chapter.id) : selectedIds.add(chapter.id);
  renderSurahs();
  renderSelection();
});
startButton.addEventListener("click", () => void startSession("practice"));
quizButton.addEventListener("click", () => void startSession("quiz"));
shareButton.addEventListener("click", () => void copyPracticeLink());
element("player-share-button").addEventListener("click", () => void copyPracticeLink());
element("translation-tab").addEventListener("click", () => showStudyTab("translation"));
element("tafsir-tab").addEventListener("click", () => showStudyTab("tafsir"));
element("tafsir-select").addEventListener("change", () => {
  renderTafsirOptions(false);
  void loadCurrentTafsir();
});
element("retry-quiz-button").addEventListener("click", restartQuiz);
element("back-button").addEventListener("click", () => {
  window.clearTimeout(delayTimer);
  window.cancelAnimationFrame(highlightFrame ?? 0);
  window.speechSynthesis?.cancel();
  audio.pause();
  audio.removeAttribute("src");
  setupView.hidden = false;
  playerView.hidden = true;
  isPlaying = false;
});
playButton.addEventListener("click", () => {
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    playButton.textContent = "▶";
    playButton.setAttribute("aria-label", t("play"));
  } else void audio.play().then(() => {
    isPlaying = true;
    playButton.textContent = "Ⅱ";
    playButton.setAttribute("aria-label", t("pause"));
  });
});
element("next-button").addEventListener("click", advance);
element("previous-button").addEventListener("click", previous);
audio.addEventListener("ended", () => mode === "quiz" ? handleQuizAudioEnded() : advance());
audio.addEventListener("waiting", () => { playbackMessage.textContent = t("loadingAudio"); });
audio.addEventListener("playing", () => {
  const verse = session[surahIndex]?.verses[verseIndex];
  if (verse) playbackMessage.textContent = t("playingAyah", { key: verse.verseKey });
  animatePlayback();
});
audio.addEventListener("timeupdate", syncTimeline);
audio.addEventListener("pause", () => window.cancelAnimationFrame(highlightFrame ?? 0));

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-language]")) {
  button.addEventListener("click", () => applyLanguage(button.dataset.language as Language));
}

applyLanguage(currentLanguage);
void loadCatalog();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js").catch(console.error));
}
