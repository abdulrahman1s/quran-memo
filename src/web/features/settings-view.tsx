import {
  CustomSelect,
  Preference,
  Hero,
  PanelHeading,
  Icon,
  styles,
  type Translator,
} from "../components/ui.tsx";
import type { MessageKey } from "../i18n.ts";

export type ArabicFont = "noto" | "amiri" | "scheherazade" | "system";
export type WordHighlightStyle = "color" | "box";
export interface ReaderPreferences {
  uiScale: number;
  arabicFont: ArabicFont;
  tafsirFont: ArabicFont;
  wordHighlightStyle: WordHighlightStyle;
  ayahScale: number;
  tafsirFontSize: number;
  playbackSpeed: number;
  autoScrollLevel: number;
}

interface SettingsViewProps {
  tr: Translator;
  preferences: ReaderPreferences;
  update<K extends keyof ReaderPreferences>(
    key: K,
    value: ReaderPreferences[K],
  ): void;
  reset(): void;
  normalizeScroll(value: unknown): number;
}

export function SettingsView(props: SettingsViewProps) {
  const speedLabel = (): MessageKey =>
    props.preferences.autoScrollLevel <= 3
      ? "scrollSpeedSlow"
      : props.preferences.autoScrollLevel <= 7
        ? "scrollSpeedMedium"
        : "scrollSpeedFast";
  return (
    <section class="w-full animate-enter py-14 max-md:py-8">
      <Hero
        tr={props.tr}
        eyebrow="settingsTab"
        title="settingsTitle"
        description="settingsDescription"
      />
      <div class={`${styles.panel} p-[34px] max-sm:p-[22px]`}>
        <PanelHeading
          tr={props.tr}
          number="01"
          title="displayAndAudio"
          description="displayAndAudioDescription"
        />
        <div class="grid gap-3">
          <Preference
            tr={props.tr}
            label="appTextSize"
            description="appTextSizeDescription"
            icon={<span class="font-sans text-sm font-bold">Aa</span>}
            output={`${props.preferences.uiScale}%`}
          >
            <input
              type="range"
              aria-label={props.tr("appTextSize")}
              min="90"
              max="130"
              step="5"
              value={props.preferences.uiScale}
              onInput={(event) =>
                props.update("uiScale", Number(event.currentTarget.value))
              }
            />
          </Preference>
          <Preference
            tr={props.tr}
            label="arabicTypeface"
            description="arabicTypefaceDescription"
            icon={<span>خط</span>}
          >
            <CustomSelect
              label={props.tr("arabicTypeface")}
              value={props.preferences.arabicFont}
              options={[
                { value: "scheherazade", label: props.tr("fontScheherazade") },
                { value: "noto", label: props.tr("fontNoto") },
                { value: "amiri", label: props.tr("fontAmiri") },
                { value: "system", label: props.tr("fontSystem") },
              ]}
              onChange={(value) =>
                props.update("arabicFont", value as ArabicFont)
              }
            />
          </Preference>
          <Preference
            tr={props.tr}
            label="tafsirTypeface"
            description="tafsirTypefaceDescription"
            icon={<span>ت</span>}
          >
            <CustomSelect
              label={props.tr("tafsirTypeface")}
              value={props.preferences.tafsirFont}
              options={[
                { value: "noto", label: props.tr("fontNoto") },
                { value: "scheherazade", label: props.tr("fontScheherazade") },
                { value: "amiri", label: props.tr("fontAmiri") },
                { value: "system", label: props.tr("fontSystem") },
              ]}
              onChange={(value) =>
                props.update("tafsirFont", value as ArabicFont)
              }
            />
          </Preference>
          <Preference
            tr={props.tr}
            label="wordHighlightStyle"
            description="wordHighlightStyleDescription"
            icon={<span>◉</span>}
          >
            <CustomSelect
              label={props.tr("wordHighlightStyle")}
              value={props.preferences.wordHighlightStyle}
              options={[
                { value: "color", label: props.tr("highlightColor") },
                { value: "box", label: props.tr("highlightBox") },
              ]}
              onChange={(value) =>
                props.update("wordHighlightStyle", value as WordHighlightStyle)
              }
            />
          </Preference>
          <Preference
            tr={props.tr}
            label="ayahTextSize"
            description="ayahTextSizeDescription"
            icon={<span>آ</span>}
            output={`${props.preferences.ayahScale}%`}
          >
            <input
              type="range"
              aria-label={props.tr("ayahTextSize")}
              min="75"
              max="150"
              step="5"
              value={props.preferences.ayahScale}
              onInput={(e) =>
                props.update("ayahScale", Number(e.currentTarget.value))
              }
            />
          </Preference>
          <div
            class="arabic-reader rounded-2xl border border-dashed border-gold/20 bg-black/10 px-5 py-[18px] text-center leading-[1.8] text-[#e9e8df]"
            dir="rtl"
          >
            إِنَّ مَعَ الْعُسْرِ يُسْرًا
          </div>
          <Preference
            tr={props.tr}
            label="tafsirTextSize"
            description="tafsirTextSizeDescription"
            icon={<span>ت</span>}
            output={`${props.preferences.tafsirFontSize}px`}
          >
            <input
              type="range"
              aria-label={props.tr("tafsirTextSize")}
              min="12"
              max="24"
              value={props.preferences.tafsirFontSize}
              onInput={(e) =>
                props.update("tafsirFontSize", Number(e.currentTarget.value))
              }
            />
          </Preference>
          <div
            class="tafsir-reader rounded-2xl border border-dashed border-gold/20 bg-black/10 px-5 py-[18px] text-center leading-[1.9] text-[#bbc6bf]"
            dir="rtl"
          >
            إن مع الشدة والضيق فرجًا وتيسيرًا.
          </div>
          <Preference
            tr={props.tr}
            label="playbackSpeed"
            description="playbackSpeedDescription"
            icon={<Icon name="play" />}
            output={`${props.preferences.playbackSpeed / 100}×`}
          >
            <input
              type="range"
              aria-label={props.tr("playbackSpeed")}
              min="50"
              max="200"
              step="10"
              value={props.preferences.playbackSpeed}
              onInput={(e) =>
                props.update("playbackSpeed", Number(e.currentTarget.value))
              }
            />
          </Preference>
          <Preference
            tr={props.tr}
            label="autoScrollSpeed"
            description="autoScrollSpeedDescription"
            icon={<span>↕</span>}
            output={props.tr(speedLabel())}
          >
            <input
              type="range"
              aria-label={props.tr("autoScrollSpeed")}
              min="1"
              max="10"
              value={props.preferences.autoScrollLevel}
              onInput={(e) =>
                props.update(
                  "autoScrollLevel",
                  props.normalizeScroll(e.currentTarget.value),
                )
              }
            />
          </Preference>
        </div>
        <button
          class={`${styles.button} mx-auto mt-6 flex`}
          onClick={props.reset}
        >
          <Icon name="reset" />
          {props.tr("resetPreferences")}
        </button>
      </div>
    </section>
  );
}
