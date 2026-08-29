import { describe, expect, test } from "bun:test";
import { recordTransition, transitionKey, weakestTransitions } from "../src/web/adaptive.ts";

describe("adaptive quiz memory", () => {
  test("records outcomes and prioritizes weak transitions", () => {
    let scores = {};
    scores = recordTransition(scores, "1:1>1:2", false);
    scores = recordTransition(scores, "1:2>1:3", true);
    expect(transitionKey("1:1", "1:2")).toBe("1:1>1:2");
    expect(weakestTransitions([{ key: "1:2>1:3" }, { key: "1:1>1:2" }], scores)).toEqual([{ key: "1:1>1:2" }]);
  });
});
