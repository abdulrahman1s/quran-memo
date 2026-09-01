import { transformAsync } from "@babel/core";
// @babel/preset-typescript does not publish TypeScript declarations.
// @ts-expect-error -- Babel accepts the preset's runtime export.
import typescript from "@babel/preset-typescript";
// babel-preset-solid does not publish TypeScript declarations.
// @ts-expect-error -- Babel accepts the preset's runtime export.
import solid from "babel-preset-solid";

export function solidPlugin(): Bun.BunPlugin {
  return {
    name: "quran-memo-solid",
    setup(build) {
      build.onLoad({ filter: /\.tsx$/ }, async ({ path }) => {
        const result = await transformAsync(await Bun.file(path).text(), {
          filename: path,
          presets: [
            [solid, { generate: "dom" }],
            [typescript, { isTSX: true, allExtensions: true }],
          ],
        });
        return { contents: result?.code ?? "", loader: "js" };
      });
    },
  };
}
