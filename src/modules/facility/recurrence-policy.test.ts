import { describe, expect, it } from "vitest";
import { decideFacilityRecurrence } from "./recurrence-policy";

describe("facility recurrence policy", () => {
  it("keeps a first unresolved occurrence at S1", () => {
    expect(decideFacilityRecurrence("WIFI", [])).toEqual({
      recurrenceKey: "FACILITY:WIFI",
      occurrenceNumber: 1,
      priorIssueIds: [],
      severity: "S1",
      urgency: "NORMAL",
      dueHours: 24,
      reasonCodes: ["SELF_HELP_UNRESOLVED"],
    });
  });

  it("promotes a matching recent facility issue to S2", () => {
    const result = decideFacilityRecurrence("WIFI", [
      { id: "wifi-1", severity: "S1", classification: { source: "FACILITY_TRIAGE", facility: "WIFI" } },
      { id: "boiler-1", severity: "S1", classification: { source: "FACILITY_TRIAGE", facility: "BOILER" } },
    ]);
    expect(result).toMatchObject({ severity: "S2", urgency: "SAME_DAY", dueHours: 8, occurrenceNumber: 2, priorIssueIds: ["wifi-1"] });
    expect(result.reasonCodes).toContain("RECURRING_FACILITY_ISSUE");
  });

  it("ignores malformed or unrelated legacy classification data", () => {
    expect(decideFacilityRecurrence("LEAK", [
      { id: "legacy-1", severity: "S1", classification: null },
      { id: "other-1", severity: "S1", classification: { facility: "LEAK" } },
    ])).toMatchObject({ severity: "S1", occurrenceNumber: 1 });
  });
});
