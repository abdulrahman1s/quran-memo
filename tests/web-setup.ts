import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { mock } from "bun:test";
import { solidPlugin } from "../scripts/solid-plugin.ts";

GlobalRegistrator.register({ url: "http://localhost/" });
Bun.plugin(solidPlugin());

// Solid selects its server renderer in Bun's test condition; DOM component
// tests need the browser implementation after Happy DOM is registered.
// @ts-expect-error -- direct browser build has no direct-path declaration.
const solid = await import("../node_modules/solid-js/dist/solid.js");
mock.module("solid-js", () => solid);
// @ts-expect-error -- the package's browser implementation has no direct-path declaration.
const solidWeb = await import("../node_modules/solid-js/web/dist/web.js");
mock.module("solid-js/web", () => solidWeb);
