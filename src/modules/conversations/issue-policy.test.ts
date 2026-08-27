import { describe, expect, it } from "vitest";
import { shouldOpenIssue } from "./issue-policy";

describe("shouldOpenIssue", () => {
  it("does not turn a grounded automatic answer into an issue", () => {
    expect(shouldOpenIssue({ route: "A", reasonCodes: ["GROUNDED_S1_LOOKUP"], immediateAlert: false })).toBe(false);
  });

  it.each(["B", "C"] as const)("opens an issue for route %s", (route) => {
    expect(shouldOpenIssue({ route, reasonCodes: ["REVIEW_REQUIRED"], immediateAlert: false })).toBe(true);
  });
});
