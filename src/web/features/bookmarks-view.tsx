import { For, Show } from "solid-js";
import type { Bookmark } from "../bookmarks.ts";
import { EmptyState } from "../components/feedback.tsx";
import { Hero, Icon, styles, type Translator } from "../components/ui.tsx";
import type { Language } from "../i18n.ts";
import { quranNumber } from "../reading.ts";
import type { ReadingTarget } from "../navigation.ts";

export function BookmarksView(props: {
  tr: Translator;
  language: Language;
  bookmarks: Bookmark[];
  open(target: ReadingTarget): void;
  remove(id: string): void;
}) {
  const groups = () => ({
    surah: props.bookmarks.filter((item) => item.type === "surah"),
    page: props.bookmarks.filter((item) => item.type === "page"),
    ayah: props.bookmarks.filter((item) => item.type === "ayah"),
  });
  const chapterName = (item: Bookmark) =>
    props.language === "ar" ? item.chapterNameArabic : item.chapterNameSimple;
  const open = (item: Bookmark) =>
    props.open({
      chapterId: item.chapterId,
      pageNumber: item.type === "surah" ? undefined : item.pageNumber,
      verseKey: item.type === "ayah" ? item.verseKey : undefined,
    });
  const metadata = (item: Bookmark) => {
    if (item.type === "surah")
      return props.tr("surahNumber", {
        number: quranNumber(item.chapterId),
      });
    if (item.type === "page")
      return props.tr("mushafPage", {
        page: quranNumber(item.pageNumber),
      });
    return item.verseKey;
  };

  const Section = (sectionProps: {
    type: Bookmark["type"];
    title: "bookmarkedSurahs" | "bookmarkedPages" | "bookmarkedAyahs";
  }) => {
    const items = () => groups()[sectionProps.type];
    return (
      <Show when={items().length}>
        <section class={`${styles.panel} p-5 max-sm:p-3.5`}>
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="font-serif text-xl text-ink rtl:font-arabic">
              {props.tr(sectionProps.title)}
            </h2>
            <span class="font-mono text-xs text-gold">
              {quranNumber(items().length)}
            </span>
          </div>
          <div class="grid gap-2">
            <For each={items()}>
              {(item) => (
                <div class="grid grid-cols-[minmax(0,1fr)_44px] overflow-hidden rounded-xl border border-white/10 bg-paper/45 transition hover:border-gold/25">
                  <button
                    type="button"
                    class="grid min-h-[84px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3.5 text-start max-sm:grid-cols-[42px_minmax(0,1fr)_auto] max-sm:gap-2.5 max-sm:px-3"
                    aria-label={props.tr("openBookmark")}
                    onClick={() => open(item)}
                  >
                    <span class="grid size-11 place-items-center rounded-xl border border-gold/20 bg-gold/[.03] text-gold max-sm:size-[42px]">
                      <Icon
                        name={item.type === "surah" ? "book" : "bookmark"}
                        class="size-4"
                      />
                    </span>
                    <span class="min-w-0">
                      <Show
                        when={item.type === "ayah"}
                        fallback={
                          <b class="block truncate text-[17px] leading-7 text-ink">
                            {chapterName(item)}
                          </b>
                        }
                      >
                        <small class="mb-0.5 block truncate text-[0.625rem] font-bold text-gold/80">
                          {chapterName(item)}
                        </small>
                        <span
                          class="bookmark-ayah-excerpt font-reader-arabic text-[22px] leading-8 text-ink max-sm:text-[20px]"
                          dir="rtl"
                        >
                          {item.type === "ayah" ? item.arabic : ""}
                        </span>
                      </Show>
                    </span>
                    <span
                      data-bookmark-meta
                      class="justify-self-end text-left font-mono text-[0.6875rem] leading-5 whitespace-nowrap text-gold max-sm:text-[0.625rem]"
                      dir="auto"
                    >
                      {metadata(item)}
                    </span>
                  </button>
                  <button
                    type="button"
                    class="grid min-h-11 place-items-center border-s border-white/10 text-muted transition hover:bg-danger/10 hover:text-danger"
                    aria-label={props.tr("removeBookmark")}
                    onClick={() => props.remove(item.id)}
                  >
                    <Icon name="trash" class="size-4" />
                  </button>
                </div>
              )}
            </For>
          </div>
        </section>
      </Show>
    );
  };

  return (
    <section class="mx-auto w-[min(900px,100%)] animate-enter py-12 max-md:py-8">
      <Hero
        tr={props.tr}
        eyebrow="bookmarksEyebrow"
        title="bookmarksTitle"
        description="bookmarksDescription"
      />
      <Show
        when={props.bookmarks.length}
        fallback={
          <EmptyState
            tr={props.tr}
            icon="bookmark"
            title="noBookmarks"
            hint="noBookmarksHint"
          />
        }
      >
        <div class="grid gap-4">
          <Section type="surah" title="bookmarkedSurahs" />
          <Section type="page" title="bookmarkedPages" />
          <Section type="ayah" title="bookmarkedAyahs" />
        </div>
      </Show>
    </section>
  );
}
