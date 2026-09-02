import { afterEach, describe, expect, test } from "bun:test";
import { render } from "solid-js/web";
import {
  CustomSelect,
  Header,
  MobileNavigation,
  RepeatControl,
} from "../src/web/components/ui.tsx";
import { translate } from "../src/web/i18n.ts";
import { ReciterPicker } from "../src/web/components/reciter-picker.tsx";
import { EmptyState, ErrorState } from "../src/web/components/feedback.tsx";
import { App } from "../src/web/app.tsx";
import { ReadingView } from "../src/web/features/reading-view.tsx";
import { SettingsView } from "../src/web/features/settings-view.tsx";
import { PlayerMasthead } from "../src/web/features/player-masthead.tsx";
import { QuizPanel } from "../src/web/features/quiz-panel.tsx";

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  localStorage.clear();
});

describe("Solid web components", () => {
  test("shows reciter identity and recitation style in the shared picker", () => {
    const root = document.createElement("div");
    document.body.append(root);
    let selected = 6;
    dispose = render(
      () => (
        <ReciterPicker
          tr={(key, values) => translate("ar", key, values)}
          language="ar"
          reciters={[
            {
              id: 6,
              nameEnglish: "Mahmoud Khalil Al-Husary",
              nameArabic: "محمود خليل الحصري",
              style: null,
            },
            {
              id: 8,
              nameEnglish: "Mohamed Siddiq al-Minshawi",
              nameArabic: "محمد صديق المنشاوي",
              style: "Mujawwad",
            },
          ]}
          value={selected}
          onChange={(value) => {
            selected = value;
          }}
        />
      ),
      root,
    );
    expect(root.textContent).toContain("محمود خليل الحصري");
    expect(root.textContent).not.toContain("Mahmoud Khalil Al-Husary");
    expect(root.textContent).toContain("مرتل");
    root.querySelector<HTMLButtonElement>('[aria-haspopup="listbox"]')?.click();
    expect(document.body.textContent).toContain("مجود");
    expect(document.body.textContent).not.toContain(
      "Mohamed Siddiq al-Minshawi",
    );
    const minshawi = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.includes("محمد صديق المنشاوي"));
    minshawi?.click();
    expect(selected).toBe(8);
  });

  test("renders navigation state and emits tab changes", () => {
    const root = document.createElement("div");
    document.body.append(root);
    let selected = "";
    dispose = render(
      () => (
        <Header
          language="en"
          tab="practice"
          tr={(key, values) => translate("en", key, values)}
          onLanguage={() => {}}
          onNavigate={(tab) => {
            selected = tab;
          }}
        />
      ),
      root,
    );
    const reading = [...root.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Mushaf"),
    );
    expect(root.querySelector('[aria-current="page"]')?.textContent).toContain(
      "Practice",
    );
    reading?.click();
    expect(selected).toBe("reading");
  });

  test("renders the Arabic labels and active language", () => {
    const root = document.createElement("div");
    document.body.append(root);
    dispose = render(
      () => (
        <Header
          language="ar"
          tab="settings"
          tr={(key, values) => translate("ar", key, values)}
          onLanguage={() => {}}
          onNavigate={() => {}}
        />
      ),
      root,
    );
    expect(root.textContent).toContain("الإعدادات");
    expect(root.querySelector('button[aria-pressed="true"]')?.textContent).toBe(
      "العربية",
    );
  });

  test("renders thumb-friendly mobile navigation", () => {
    const root = document.createElement("div");
    document.body.append(root);
    let selected = "";
    dispose = render(
      () => (
        <MobileNavigation
          tab="reading"
          tr={(key, values) => translate("en", key, values)}
          onNavigate={(tab) => {
            selected = tab;
          }}
        />
      ),
      root,
    );
    const navigation = root.querySelector('[aria-label="Mobile navigation"]');
    expect(navigation?.querySelectorAll("button")).toHaveLength(4);
    expect(
      navigation?.querySelector('[aria-current="page"]')?.textContent,
    ).toContain("Mushaf");
    [...(navigation?.querySelectorAll("button") ?? [])]
      .find((button) => button.textContent?.includes("Settings"))
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(selected).toBe("settings");
  });

  test("uses a custom listbox instead of a device select", () => {
    const root = document.createElement("div");
    document.body.append(root);
    let selected = "";
    dispose = render(
      () => (
        <CustomSelect
          label="Reciter"
          value="husary"
          options={[
            { value: "husary", label: "Mahmoud Khalil Al-Husary" },
            { value: "minshawi", label: "Mohamed Siddiq al-Minshawi" },
          ]}
          onChange={(value) => {
            selected = value;
          }}
        />
      ),
      root,
    );
    expect(root.querySelector("select")).toBeNull();
    const trigger = root.querySelector<HTMLButtonElement>(
      '[aria-haspopup="listbox"]',
    );
    trigger?.click();
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    document.querySelectorAll<HTMLButtonElement>('[role="option"]')[1]?.click();
    expect(selected).toBe("minshawi");
    trigger?.click();
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  test("adjusts repeat settings from the player control", () => {
    const root = document.createElement("div");
    document.body.append(root);
    let change = 0;
    dispose = render(
      () => (
        <RepeatControl
          label="Ayah repeats"
          current={1}
          target={2}
          onDecrease={() => {
            change = -1;
          }}
          onIncrease={() => {
            change = 1;
          }}
        />
      ),
      root,
    );
    root
      .querySelector<HTMLButtonElement>('[aria-label="Ayah repeats: increase"]')
      ?.click();
    expect(change).toBe(1);
  });

  test("uses the Arabic-first player masthead", () => {
    const root = document.createElement("div");
    document.body.append(root);
    dispose = render(
      () => (
        <PlayerMasthead
          tr={(key, values) => translate("ar", key, values)}
          chapter={{
            id: 2,
            nameSimple: "Al-Baqarah",
            nameArabic: "البقرة",
            versesCount: 286,
          }}
          verse={{
            verseKey: "2:3",
            chapterId: 2,
            juzNumber: 1,
            hizbNumber: 1,
            arabic: "الم",
            translation: "Alif, Lam, Meem.",
            audioUrl: "https://audio/2:3",
          }}
          number={String}
        />
      ),
      root,
    );
    expect(root.textContent).toContain("الآية 3 من 286");
    expect(root.textContent).toContain("سورة 2");
    expect(root.textContent).toContain("الجزء 1 · الحزب 1");
    expect(root.textContent).toContain("Al-Baqarah");
    expect(root.textContent).toContain("البقرة");
  });

  test("renders quiz choices with the Quran reader font", () => {
    const root = document.createElement("div");
    document.body.append(root);
    let selected = "";
    dispose = render(
      () => (
        <QuizPanel
          tr={(key, values) => translate("en", key, values)}
          choices={[{ verseKey: "2:2", arabic: "ذلك الكتاب لا ريب فيه" }]}
          expectedVerseKey="2:2"
          correct={0}
          total={0}
          onAnswer={(choice) => {
            selected = choice.verseKey;
          }}
        />
      ),
      root,
    );
    const choice = root.querySelector<HTMLButtonElement>(".quiz-choice");
    expect(choice?.getAttribute("lang")).toBe("ar");
    choice?.click();
    expect(selected).toBe("2:2");
  });

  test("turns Mushaf boundaries into navigable reading pages", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    let playedWord = "";
    let inspectedWord = "";
    let soughtWord = "";
    let soughtAyah = "";
    let audioToggled = false;
    const chapter = {
      id: 2,
      nameSimple: "Al-Baqarah",
      nameArabic: "البقرة",
      versesCount: 2,
    };
    dispose = render(
      () => (
        <ReadingView
          tr={(key, values) => translate("en", key, values)}
          language="en"
          chapters={[chapter]}
          chapterId={2}
          payload={{
            chapter,
            verses: [
              {
                verseKey: "2:1",
                arabic: "الصفحة الأولى",
                pageNumber: 2,
                juzNumber: 1,
                hizbNumber: 1,
                audioUrl: "/audio/2_1.mp3",
                words: [
                  { position: 1, text: "الصفحة" },
                  { position: 2, text: "الأولى" },
                ],
                wordTimings: [
                  { position: 1, startMs: 0, endMs: 300 },
                  { position: 2, startMs: 310, endMs: 600 },
                ],
              },
              {
                verseKey: "2:2",
                arabic: "الصفحة الثانية",
                pageNumber: 3,
                juzNumber: 1,
                hizbNumber: 2,
                audioUrl: "/audio/2_2.mp3",
                words: [
                  { position: 1, text: "الصفحة" },
                  { position: 2, text: "الثانية" },
                ],
                wordTimings: [
                  { position: 1, startMs: 0, endMs: 300 },
                  { position: 2, startMs: 310, endMs: 620 },
                ],
              },
            ],
          }}
          loading={false}
          error={false}
          scrolling={false}
          scrollComplete={false}
          load={() => {}}
          startScroll={() => {}}
          pauseScroll={() => {}}
          chapterName={(item) => item.nameSimple}
          playWord={(verse, position) => {
            playedWord = `${verse.verseKey}:${position}`;
          }}
          inspectWord={(verse, position) => {
            inspectedWord = `${verse.verseKey}:${position}`;
          }}
          seekWord={(verse, position) => {
            soughtWord = `${verse.verseKey}:${position}`;
          }}
          seekAyah={(verse) => {
            soughtAyah = verse.verseKey;
          }}
          activeWord="2:1:1"
          boxHighlight={true}
          audioVisible={true}
          audioPlaying={false}
          audioAyah={0}
          audioTime={0}
          audioDuration={0}
          reciterName="Al-Husary"
          reciterId={6}
          reciters={[
            {
              id: 6,
              nameEnglish: "Al-Husary",
              nameArabic: "الحصري",
              style: "Murattal",
            },
          ]}
          changeReciter={() => {}}
          toggleAudio={() => {
            audioToggled = true;
          }}
          previousAudio={() => {}}
          nextAudio={() => {}}
          closeAudio={() => {}}
        />
      ),
      root,
    );
    expect(root.textContent).toContain("الصفحة الأولى");
    expect(root.textContent).not.toContain("الصفحة الثانية");
    expect(root.textContent).toContain(
      "In the Name of Allah—the Most Compassionate, Most Merciful",
    );
    expect(root.textContent).toContain("Juz ١ · Hizb ١");
    expect(root.querySelector('img[src="/besmllah.svg"]')).not.toBeNull();
    const readingToolbar = root.querySelector<HTMLElement>(
      "[data-reading-toolbar]",
    );
    expect(readingToolbar?.classList.contains("sticky")).toBe(true);
    expect(readingToolbar?.classList.contains("max-md:fixed")).toBe(true);
    expect(readingToolbar?.className).toContain(
      "bottom-[calc(var(--bottom-nav-h)+12px)]",
    );
    const mobilePageRow = root.querySelector<HTMLElement>(
      "[data-mobile-page-row]",
    );
    expect(
      mobilePageRow?.querySelector('[aria-label="Previous page"]'),
    ).not.toBeNull();
    expect(
      mobilePageRow
        ?.querySelector('[aria-label="Previous page"] svg')
        ?.getAttribute("class"),
    ).toContain("rtl:rotate-180");
    expect(mobilePageRow?.querySelector(".reciter-picker")).not.toBeNull();
    expect(
      mobilePageRow?.querySelector('[aria-label="Next page"]'),
    ).not.toBeNull();
    expect(
      mobilePageRow
        ?.querySelector('[aria-label="Next page"] svg')
        ?.getAttribute("class"),
    ).toContain("rtl:rotate-180");
    const mobileSurahRow = root.querySelector<HTMLElement>(
      "[data-mobile-surah-row]",
    );
    expect(
      mobileSurahRow?.querySelector('[aria-label="Surah"]'),
    ).not.toBeNull();
    expect(
      mobileSurahRow?.querySelector(".reading-mobile-scroll-action"),
    ).not.toBeNull();
    expect(
      root.querySelector<HTMLElement>("[data-mobile-audio-player]")?.className,
    ).toContain("bottom-[calc(var(--bottom-nav-h)+12px)]");
    expect(
      root
        .querySelector<HTMLButtonElement>(".reading-page-action")
        ?.classList.contains("hidden"),
    ).toBe(true);
    expect(root.querySelector("[data-ayah-marker]")?.textContent?.trim()).toBe(
      "١",
    );
    expect(root.querySelector(".mushaf-verse")?.textContent).toContain(
      "\u00a0١",
    );
    expect(
      root.querySelector("[data-ayah-marker] .mushaf-ayah-marker-frame"),
    ).not.toBeNull();
    expect(
      root.querySelector("[data-ayah-marker] .mushaf-ayah-number"),
    ).not.toBeNull();
    expect(root.querySelector("[data-ayah-marker]")?.classList).not.toContain(
      "rounded-full",
    );
    const readingWord =
      root.querySelector<HTMLButtonElement>("button.mushaf-word");
    expect(readingWord?.getAttribute("aria-label")).toContain("الصفحة");
    expect(readingWord?.dataset.wordKey).toBe("2:1:1");
    expect(readingWord?.classList).toContain("active");
    expect(readingWord?.classList).toContain("box");
    readingWord?.click();
    await new Promise((resolve) => setTimeout(resolve, 260));
    expect(playedWord).toBe("2:1:1");
    playedWord = "";
    readingWord?.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: 20,
        clientY: 20,
        pointerType: "touch",
      }),
    );
    readingWord?.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: 20,
        clientY: 60,
        pointerType: "touch",
      }),
    );
    readingWord?.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: 20,
        clientY: 60,
        pointerType: "touch",
      }),
    );
    readingWord?.click();
    await new Promise((resolve) => setTimeout(resolve, 260));
    expect(playedWord).toBe("");
    readingWord?.click();
    readingWord?.click();
    readingWord?.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 260));
    expect(playedWord).toBe("");
    expect(soughtWord).toBe("2:1:1");
    readingWord?.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    expect(inspectedWord).toBe("2:1:1");
    root
      .querySelector<HTMLElement>(".mushaf-verse")
      ?.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, cancelable: true }),
      );
    expect(soughtAyah).toBe("2:1");
    root.querySelector<HTMLButtonElement>('[aria-label="Play surah"]')?.click();
    expect(audioToggled).toBe(true);
    root.querySelector<HTMLButtonElement>('[aria-label="Next page"]')?.click();
    expect(root.textContent).toContain("الصفحة الثانية");
    expect(root.textContent).not.toContain("الصفحة الأولى");
  });

  test("starts Al-Fatiha numbering after the unnumbered Basmala at one", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const chapter = {
      id: 1,
      nameSimple: "Al-Fatihah",
      nameArabic: "الفاتحة",
      versesCount: 2,
    };
    dispose = render(
      () => (
        <ReadingView
          tr={(key, values) => translate("en", key, values)}
          language="en"
          chapters={[chapter]}
          chapterId={1}
          payload={{
            chapter,
            verses: [
              {
                verseKey: "1:1",
                arabic: "بسم الله الرحمن الرحيم",
                pageNumber: 1,
                juzNumber: 1,
                hizbNumber: 1,
                audioUrl: "/audio/1_1.mp3",
                words: [],
                wordTimings: [],
              },
              {
                verseKey: "1:2",
                arabic: "الحمد لله رب العالمين",
                pageNumber: 1,
                juzNumber: 1,
                hizbNumber: 1,
                audioUrl: "/audio/1_2.mp3",
                words: [],
                wordTimings: [],
              },
            ],
          }}
          loading={false}
          error={false}
          scrolling={false}
          scrollComplete={false}
          load={() => {}}
          startScroll={() => {}}
          pauseScroll={() => {}}
          chapterName={(item) => item.nameSimple}
          playWord={() => {}}
          inspectWord={() => {}}
          seekWord={() => {}}
          seekAyah={() => {}}
          boxHighlight={false}
          audioVisible={false}
          audioPlaying={false}
          audioAyah={0}
          audioTime={0}
          audioDuration={0}
          reciterName="Al-Husary"
          reciterId={6}
          reciters={[
            {
              id: 6,
              nameEnglish: "Al-Husary",
              nameArabic: "الحصري",
              style: "Murattal",
            },
          ]}
          changeReciter={() => {}}
          toggleAudio={() => {}}
          previousAudio={() => {}}
          nextAudio={() => {}}
          closeAudio={() => {}}
        />
      ),
      root,
    );
    expect(root.querySelector("[data-ayah-marker]")?.textContent?.trim()).toBe(
      "١",
    );
  });

  test("offers color and box word highlight preferences", () => {
    const root = document.createElement("div");
    document.body.append(root);
    let highlight = "color";
    dispose = render(
      () => (
        <SettingsView
          tr={(key, values) => translate("en", key, values)}
          preferences={{
            uiScale: 100,
            arabicFont: "noto",
            tafsirFont: "noto",
            wordHighlightStyle: "color",
            ayahScale: 100,
            tafsirFontSize: 15,
            playbackSpeed: 100,
            autoScrollLevel: 4,
          }}
          update={(key, value) => {
            if (key === "wordHighlightStyle") highlight = String(value);
          }}
          normalizeScroll={(value) => Number(value)}
          reset={() => {}}
        />
      ),
      root,
    );
    const trigger = root.querySelector<HTMLButtonElement>(
      '[aria-label="Word highlight"]',
    );
    expect(root.querySelector('[aria-label="App text size"]')).not.toBeNull();
    expect(root.querySelector('[aria-label="Tafsir typeface"]')).not.toBeNull();
    expect(trigger).not.toBeNull();
    trigger?.click();
    const boxOption = [
      ...document.querySelectorAll<HTMLButtonElement>('[role="option"]'),
    ].find((option) => option.textContent?.includes("Filled box"));
    expect(boxOption).not.toBeUndefined();
    boxOption?.click();
    expect(highlight).toBe("box");
    trigger?.click();
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  test("renders reusable error and empty feedback states", () => {
    const root = document.createElement("div");
    document.body.append(root);
    let retries = 0;
    dispose = render(
      () => (
        <>
          <ErrorState
            tr={(key, values) => translate("en", key, values)}
            message="catalogFailed"
            onRetry={() => retries++}
          />
          <EmptyState
            tr={(key, values) => translate("en", key, values)}
            icon="download"
            title="noOfflineDownloads"
            hint="noOfflineDownloadsHint"
          />
        </>
      ),
      root,
    );
    root.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    expect(retries).toBe(1);
    expect(root.textContent).toContain("No downloaded surahs");
    expect(root.textContent).toContain("Pick surahs above");
  });

  test("opens the Downloads tab", async () => {
    history.replaceState(null, "", "http://localhost/");
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            chapters: [],
            reciters: [],
            tafsirs: [],
            defaultReciterId: 6,
          }),
          { headers: { "content-type": "application/json" } },
        ),
      )) as unknown as typeof fetch;
    const root = document.createElement("div");
    document.body.append(root);
    dispose = render(() => <App />, root);
    const downloads = [...root.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Downloads"),
    );
    downloads?.click();
    await Promise.resolve();
    expect(location.search).toContain("view=downloads");
    expect(root.textContent).toContain("Take your recitation anywhere");
    expect(root.textContent).toContain("Download all surahs");
  });

  test("shows a toast when preferences reset", async () => {
    history.replaceState(null, "", "http://localhost/");
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            chapters: [],
            reciters: [],
            tafsirs: [],
            defaultReciterId: 6,
          }),
          { headers: { "content-type": "application/json" } },
        ),
      )) as unknown as typeof fetch;
    const root = document.createElement("div");
    document.body.append(root);
    dispose = render(() => <App />, root);
    const settings = [...root.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Settings"),
    );
    settings?.click();
    await Promise.resolve();
    const reset = [...root.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Restore defaults"),
    );
    reset?.click();
    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      "Reading preferences restored",
    );
  });
});
