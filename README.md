# Quran Memo

Quran Memo is a lightweight Quran listening and memorization app built with Bun and plain TypeScript. Choose one or more complete Surahs, listen to them in focused loops, follow the Arabic text word by word, or test yourself by identifying the next Ayah.

It runs in three ways:

- As an interactive terminal application using `mpv`.
- As a local browser application powered by `Bun.serve()`.
- As a deployable Cloudflare Worker with Static Assets and edge caching.

Mahmoud Khalil Al-Husary — Murattal is the default reciter. Quran text, translations, reciter metadata, timing data, and audio references are retrieved from Quran.com and Quran Foundation services.

## Features

- Search and select multiple Surahs in Arabic or English.
- Play complete Surahs in Quran order.
- Repeat each complete Surah three times by default before continuing.
- Configure Ayah repetitions, Surah repetitions, full-selection cycles, and separate pauses.
- Choose from Quran.com's available Ayah-by-Ayah reciters.
- Highlight the currently recited Arabic word using Quran.com timing segments.
- Announce the Surah name in Arabic before playback begins.
- Practice with a four-choice “Which Ayah comes next?” audio quiz.
- Receive an accuracy score after completing a quiz.
- Revisit weak Ayah transitions automatically through an adaptive quiz history stored on the device.
- Choose a memorization display: full Ayah, first three words, word initials, or hidden text.
- Read the translation or load a Quran.com Tafsir for the current Ayah.
- Use the Settings tab to adjust Ayah text scale, Tafsir text size, and playback speed; preferences persist on the device.
- Copy a practice link that restores the Surahs, reciter, language, repetition rules, and display mode.
- Install the browser app as a PWA and reuse previously loaded app data offline.
- Manually download selected Surahs for reliable offline audio, with progress and per-reciter status.
- Remove downloaded audio from the device without clearing practice settings or quiz history.
- Use the responsive interface on mobile and desktop.
- Switch the interface between English and Arabic with full RTL support.
- Cache API responses and audio for faster repeat sessions.
- Run without a frontend framework or runtime npm dependencies.

## How repetition works

Ayah and complete-Surah repetition are configured independently. By default, each Ayah plays once, each complete Surah plays three times, and the browser stops after one full-selection cycle. Continuous playback must be selected explicitly.

For example, with Al-Fatihah and Al-Ikhlas selected and the repetition count set to three, playback follows this order:

```text
Al-Fatihah from beginning to end ×3
Al-Ikhlas from beginning to end ×3
Then repeat the full selection if another cycle is configured
```

Setting Ayah repeats to two changes every pass to `1, 1, 2, 2, 3, 3…`. The Ayah pause applies between those playbacks; the Surah pause applies only before another complete pass of the same Surah.

## Offline listening

Open the browser app's **Downloads** tab, choose a reciter and one or more Surahs, then select **Download selected**. The app downloads every Ayah with visible progress, reports the selected download and total cache sizes, and marks completed Surahs as **Offline** for that reciter. Download selection is separate from practice selection. The session data and audio are stored in a dedicated browser cache so the installed PWA can play the same selection without a connection.

Offline audio is reciter-specific: changing the reciter requires a separate download. Select **Remove downloads** to clear all manually downloaded session data and audio. This does not remove language preferences, practice settings, or adaptive quiz history.

Each web build generates a new PWA cache version. Installed copies check for service-worker updates immediately and once per hour, activate new assets without waiting, remove the previous app-shell cache, and reload once to apply the update.

## Requirements

- [Bun](https://bun.sh/) 1.3 or newer.
- [mpv](https://mpv.io/) for terminal audio playback. It is not required for browser mode.
- [fzf](https://github.com/junegunn/fzf) for the best terminal selection experience. A numbered fallback is included.

## Installation

Clone the repository, then install the development dependencies:

```sh
bun install
```

## Browser application

Start the local Bun server:

```sh
bun run web
```

Open [http://localhost:3000](http://localhost:3000). To use another port:

```sh
bun run start -- --web --port 4321
```

The setup screen lets you select a reciter, choose multiple Surahs, configure repetition and memorization cues, and start either a listening session or a memory quiz. Use **Copy practice link** to share the complete setup without forcing audio to autoplay for the recipient.

The app includes a web manifest and service worker. On a supporting browser, use the browser's **Install app** or **Add to Home Screen** action. The interface, previously requested session data, and Tafsir can be reused from browser storage when available. Audio continues to use the browser HTTP cache and the server or Cloudflare audio cache.

Browsers may prevent audio from starting until the page receives a user interaction. If that happens, press the play button once.

## Terminal application

Start the interactive CLI:

```sh
bun run start
```

With `fzf` installed:

- Type to search reciters and Surahs.
- Move with the arrow keys or `j` and `k`.
- Toggle Surahs with `Tab` or `Shift+Tab`.
- Select all filtered Surahs with `Alt+A`.
- Confirm with `Enter`.
- Cancel with `Esc` or `Ctrl+C`.

Selected Surahs are always normalized into Quran order.

### Non-interactive usage

```sh
bun run start -- \
  --surahs 1,36,108-114 \
  --reciter 6 \
  --ayah-repeat 2 \
  --repeat 3 \
  --cycles forever \
  --ayah-delay 1 \
  --delay 0
```

| Option | Description |
| --- | --- |
| `-s, --surahs <list>` | Surah numbers, comma-separated lists, or ranges. |
| `-r, --reciter <id>` | Quran.com recitation ID. Defaults to Al-Husary Murattal. |
| `-n, --repeat <count>` | Complete-Surah repetitions. Defaults to `3`. |
| `--ayah-repeat <count>` | Repetitions for every Ayah. Defaults to `1`. |
| `-c, --cycles <value>` | Full-selection cycles or `forever`. |
| `-d, --delay <seconds>` | Pause between repeats of the same Surah. |
| `--ayah-delay <seconds>` | Pause after each Ayah or Ayah repetition. |
| `-w, --web` | Start the local browser interface. |
| `-p, --port <number>` | Browser server port. Defaults to `3000`. |
| `-h, --help` | Print CLI help. |

When stdin is not interactive, `--surahs` is required. The standalone CLI streams audio into `mpv`, which also supports sandboxed wrappers that reject remote URL arguments.

## Memory quiz

The quiz plays the current Ayah, then presents four Arabic choices for the next Ayah. After an answer:

1. The correct choice is revealed.
2. The next Ayah is played with synchronized word highlighting.
3. The quiz continues through every selected Surah.
4. A final accuracy percentage is shown.

Distractors are unique and may be drawn from outside the selected Surah when the current selection does not contain enough Ayat. Results for each Ayah-to-Ayah transition are kept in local browser storage. Transitions with more mistakes are replayed as adaptive review questions in later quizzes; no account or server-side learning profile is required.

## Caching

### Local Bun modes

The CLI and local browser server share a persistent disk cache:

```text
$XDG_CACHE_HOME/quran-memo
# or ~/.cache/quran-memo when XDG_CACHE_HOME is unset
```

- Quran API JSON is cached for 24 hours.
- Stale JSON may be used when Quran.com is temporarily unreachable.
- Audio is downloaded once and reused in later sessions.
- Browser audio seeking is supported through byte-range responses.

No downloaded audio is stored inside the repository.

### Cloudflare Workers

The Cloudflare deployment uses both Cloudflare's edge cache and the browser's standard HTTP cache:

| Resource | Cache policy |
| --- | --- |
| Quran catalog | 24 hours |
| Prepared session data | 5 minutes |
| Ayah audio | 1 year, immutable |

The Worker proxies only trusted Quran audio hosts. Cached audio supports HTTP range requests for playback and seeking. Large Surah selections are automatically divided into API batches to stay within Cloudflare Workers subrequest limits while preserving Quran order.

## Cloudflare deployment

Wrangler is included as a development dependency. Preview the production Worker locally:

```sh
bun run cf:dev
```

The development launcher automatically passes a detected system CA bundle to Wrangler when needed, including on NixOS.

Authenticate and deploy:

```sh
bunx wrangler login
bun run cf:deploy
```

The Worker configuration is in [`wrangler.jsonc`](./wrangler.jsonc). Change its `name` field before deployment if you want a different Workers project name.

## Development

Useful commands:

| Command | Purpose |
| --- | --- |
| `bun run web` | Run the local Bun browser server. |
| `bun run cf:dev` | Build the frontend and run it in the local Workers runtime. |
| `bun run build:web` | Compile browser TypeScript and copy static assets. |
| `bun test` | Run the test suite. |
| `bun run check` | Type-check the project. |
| `bun run build` | Compile the standalone CLI executable. |
| `bun run cf:deploy` | Build and deploy to Cloudflare Workers. |

Build the standalone executable:

```sh
bun run build
./dist/quran-memo --help
```

The compiled terminal executable still requires `mpv` at runtime and uses `fzf` when available.

## Project structure

```text
src/
├── api.ts             Quran.com API client and response validation
├── cache.ts           Persistent Bun disk cache
├── cli.ts             Terminal entry point
├── playback.ts        mpv playback and Surah loop orchestration
├── select.ts          Interactive terminal selectors
├── worker.ts          Cloudflare Worker API and edge cache
└── web/
    ├── app.ts         Browser application
    ├── adaptive.ts    Persistent weak-transition prioritization
    ├── index.html     Interface markup
    ├── memorization.ts Text-cue display modes
    ├── practice-link.ts Shareable session serialization
    ├── pwa-assets.ts  Web manifest, icon, and offline service worker
    ├── styles.css     Responsive English and Arabic styles
    ├── quiz.ts        Quiz choice and scoring logic
    └── timing.ts      Recitation word-highlight synchronization
```

The browser interface uses plain HTML, CSS, and TypeScript. The only installed packages are TypeScript typings/tooling and Wrangler for Cloudflare development.

## Data sources and attribution

Quran Memo currently uses the public `api.quran.com/api/v4` content endpoints and Quran Foundation audio URLs so it can run without API credentials. Quran Foundation recommends its authenticated Content API for new integrations; if the public endpoints change or are retired, this project may require an API migration.

This project is not affiliated with or endorsed by Quran.com or Quran Foundation. Quran text, translations, metadata, timing information, and recitations remain subject to their respective sources and terms.

## Contributing

Issues and pull requests are welcome. For code changes:

1. Keep runtime dependencies minimal.
2. Prefer native Bun, browser, and Workers APIs.
3. Add tests for behavior changes.
4. Run `bun test` and `bun run check` before submitting.

Please be especially careful with Arabic text, Ayah ordering, reciter attribution, and playback behavior.

## Author

Abdulrahman Salah — [mail@abdulrahman.dev](mailto:mail@abdulrahman.dev)

## License

No software license has been specified yet. Public availability of the source code does not by itself grant permission to copy, modify, or redistribute it.
