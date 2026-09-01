import { describe, expect, test } from "bun:test";
import { parseByteRange } from "../src/web/range.ts";

describe("HTTP audio byte ranges", () => {
  test("parses bounded and open-ended ranges", () => {
    expect(parseByteRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseByteRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange("bytes=90-200", 100)).toEqual({ start: 90, end: 99 });
  });

  test("parses suffix ranges from the end of the file", () => {
    expect(parseByteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange("bytes=-200", 100)).toEqual({ start: 0, end: 99 });
  });

  test("rejects malformed or unsatisfiable ranges", () => {
    expect(parseByteRange("bytes=-0", 100)).toBeUndefined();
    expect(parseByteRange("bytes=100-", 100)).toBeUndefined();
    expect(parseByteRange("bytes=20-10", 100)).toBeUndefined();
    expect(parseByteRange("bytes=0-1,4-5", 100)).toBeUndefined();
  });
});
