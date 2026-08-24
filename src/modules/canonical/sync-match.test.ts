import { describe, expect, it } from "vitest";
import { mapCanonicalMatchStatus } from "./sync-match";

describe("canonical match status mapping", () => {
  it("keeps move-out-scheduled residents active until the cycle ends", () => {
    expect(mapCanonicalMatchStatus("MOVE_OUT_SCHEDULED")).toBe("ACTIVE");
  });
  it("maps supported terminal states and rejects unknown values", () => {
    expect(mapCanonicalMatchStatus("ENDED")).toBe("ENDED");
    expect(mapCanonicalMatchStatus("CANCELLED")).toBe("CANCELLED");
    expect(mapCanonicalMatchStatus("UNKNOWN")).toBeNull();
  });
});
