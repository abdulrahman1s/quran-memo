import { pwaIcon, pwaManifest, serviceWorkerSource } from "../src/web/pwa-assets.ts";
import { solidPlugin } from "./solid-plugin.ts";

const css = Bun.spawn([
  "bunx", "@tailwindcss/cli",
  "-i", "src/web/styles.css",
  "-o", "dist/web/styles.css",
  "--minify",
], { stdout: "inherit", stderr: "inherit" });

const result = await Bun.build({
  entrypoints: ["src/web/app.tsx"],
  outdir: "dist/web",
  target: "browser",
  minify: true,
  naming: "app.js",
  plugins: [solidPlugin()],
});

const cssExitCode = await css.exited;

if (!result.success || cssExitCode !== 0) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const html = (await Bun.file("src/web/index.html").text())
  .replace("../../dist/web/styles.css", "/styles.css")
  .replace("../../dist/web/app.js", "/app.js");

await Promise.all([
  Bun.write("dist/web/index.html", html),
  Bun.write("dist/web/manifest.webmanifest", pwaManifest),
  Bun.write("dist/web/icon.svg", pwaIcon),
  Bun.write("dist/web/besmllah.svg", Bun.file("besmllah.svg")),
  Bun.write("dist/web/sw.js", serviceWorkerSource),
]);

console.log("Built Cloudflare static assets in dist/web");
