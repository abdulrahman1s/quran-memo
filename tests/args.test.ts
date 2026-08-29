import { describe, expect, test } from "bun:test";
import { parseCliArgs, parseCycles, parseSurahSpec } from "../src/args.ts";

describe("parseSurahSpec", () => {
  test("accepts individual chapters, ranges, whitespace, and duplicates", () => {
    expect(parseSurahSpec("1, 36,108-110,36")).toEqual([1, 36, 108, 109, 110]);
  });

  test("rejects reversed and out-of-bounds ranges", () => {
    expect(() => parseSurahSpec("10-2")).toThrow("reversed");
    expect(() => parseSurahSpec("113-115")).toThrow("between 1 and 114");
    expect(() => parseSurahSpec("0")).toThrow("positive integer");
  });
});

describe("CLI arguments", () => {
  test("parses a complete non-interactive session", () => {
    expect(parseCliArgs([
      "--surahs", "1,108-109",
      "--reciter", "7",
      "--repeat", "3",
      "--ayah-repeat", "2",
      "--cycles", "2",
      "--delay", "1.5",
      "--ayah-delay", "0.5",
    ])).toEqual({
      help: false,
      web: false,
      port: undefined,
      surahIds: [1, 108, 109],
      reciterId: 7,
      surahRepeats: 3,
      ayahRepeats: 2,
      cycles: 2,
      delaySeconds: 1.5,
      ayahDelaySeconds: 0.5,
    });
  });

  test("supports forever and short flags", () => {
    const options = parseCliArgs(["-s", "1", "-r", "8", "-c", "forever", "-h"]);
    expect(options.cycles).toBe("forever");
    expect(options.help).toBe(true);
  });

  test("parses web mode and validates its port", () => {
    expect(parseCliArgs(["--web", "--port", "4321"])).toMatchObject({ web: true, port: 4321 });
    expect(() => parseCliArgs(["--web", "--port", "70000"])).toThrow("between 1 and 65535");
  });

  test("validates numerical settings", () => {
    expect(() => parseCliArgs(["--repeat", "0"])).toThrow("positive integer");
    expect(() => parseCliArgs(["--delay=-1"])).toThrow("non-negative");
    expect(() => parseCliArgs(["--ayah-repeat", "0"])).toThrow("positive integer");
    expect(() => parseCycles("sometimes")).toThrow("positive integer");
  });
});
