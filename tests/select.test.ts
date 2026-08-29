import { expect, test } from "bun:test";
import { formatFzfItems, parseFzfIds } from "../src/select.ts";

test("fzf rows hide a stable numeric ID behind each label", () => {
  expect(formatFzfItems([
    { id: 1, label: "الفاتحة — Al-Fatihah" },
    { id: 108, label: "الكوثر — Al-Kawthar" },
  ])).toBe("1\tالفاتحة — Al-Fatihah\n108\tالكوثر — Al-Kawthar\n");
});

test("fzf output is parsed as selected IDs", () => {
  expect(parseFzfIds("108\tالكوثر — Al-Kawthar\n1\tالفاتحة — Al-Fatihah\n"))
    .toEqual([108, 1]);
});
