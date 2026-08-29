const result = await Bun.build({
  entrypoints: ["src/web/app.ts"],
  outdir: "dist/web",
  target: "browser",
  minify: true,
  naming: "app.js",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const html = (await Bun.file("src/web/index.html").text())
  .replace('src="./app.ts"', 'src="./app.js"');

await Promise.all([
  Bun.write("dist/web/index.html", html),
  Bun.write("dist/web/styles.css", Bun.file("src/web/styles.css")),
]);

console.log("Built Cloudflare static assets in dist/web");
