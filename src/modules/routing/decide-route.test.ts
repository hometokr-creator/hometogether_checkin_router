import { describe, expect, it } from "vitest";
import { hh002Classification } from "../demo/hh002";
import { decideRoute } from "./decide-route";
describe("decideRoute", () => {
  it("routes HH-002 to a human", () => expect(decideRoute(hh002Classification, "NO_CLAUSE").route).toBe("B"));
  it("routes safe facilities to C", () => expect(decideRoute({ ...hh002Classification, domain: "FACILITY", severity: "S1", distressSignal: "NONE", direction: "NOT_APPLICABLE" }, "NOT_APPLICABLE").route).toBe("C"));
  it("alerts on critical risk", () => expect(decideRoute({ ...hh002Classification, riskFlags: ["SAFETY"] }, "CLAUSE_EXISTS")).toMatchObject({ route: "B", immediateAlert: true }));
  it("requires grounding for A", () => { const lookup = { ...hh002Classification, intent: "QUESTION" as const, domain: "KITCHEN" as const, severity: "S1" as const, urgency: "NORMAL" as const, direction: "NOT_APPLICABLE" as const, interventionPreference: "UNKNOWN" as const, distressSignal: "NONE" as const }; expect(decideRoute(lookup, "CLAUSE_EXISTS").route).toBe("A"); expect(decideRoute(lookup, "NO_CLAUSE").route).toBe("B"); });
});
