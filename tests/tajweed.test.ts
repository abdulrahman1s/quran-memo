import { describe, expect, test } from "bun:test";
import { extractTajweedRules } from "../src/tajweed.ts";
import { prioritizeTajweedRules } from "../src/web/tajweed.ts";

describe("extractTajweedRules", () => {
  test("extracts unique supported rules from current Quran.com markup", () => {
    expect(
      extractTajweedRules(
        "<rule class=ham_wasl>ٱ</rule><rule class=laam_shamsiyah>ل</rule>صِّر<rule class=madda_normal><rule class=custom-alef-maksora>ٰ</rule></rule>",
      ),
    ).toEqual(["ham_wasl", "laam_shamsiyah", "madda_normal"]);
  });

  test("supports quoted and legacy Tajweed markup", () => {
    expect(
      extractTajweedRules(
        '<tajweed class="qlq">قْ</tajweed><tajweed class="qlq ignored">قْ</tajweed>',
      ),
    ).toEqual(["qalaqah"]);
  });

  test("ignores decorative classes and empty markup", () => {
    expect(
      extractTajweedRules("<rule class=custom-alef-maksora>ٰ</rule>"),
    ).toEqual([]);
    expect(extractTajweedRules()).toEqual([]);
  });
});

describe("prioritizeTajweedRules", () => {
  test("puts the teaching rule before routine letter markings", () => {
    expect(
      prioritizeTajweedRules(["ham_wasl", "madda_normal", "idgham_ghunnah"]),
    ).toEqual(["idgham_ghunnah", "ham_wasl", "madda_normal"]);
  });
});
