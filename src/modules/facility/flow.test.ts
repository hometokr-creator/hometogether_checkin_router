import { describe, expect, it } from "vitest";
import { startFacilityTriage, submitFacilityReply } from "./flow";
import { presentFacilityTriage } from "./presentation";

describe("facility triage flow", () => {
  it("guides a safe Wi-Fi problem and completes without escalation when resolved", () => {
    const started = startFacilityTriage({ description: "와이파이가 안 돼요", initialMessageId: "message-1" });
    expect(started.facility).toBe("WIFI");
    const safe = submitFacilityReply({ state: started, expectedVersion: 1, value: "FACILITY_SAFETY:SAFE" });
    expect(presentFacilityTriage(safe).text).toContain("초기화 버튼은 누르지 마세요");
    const resolved = submitFacilityReply({ state: safe, expectedVersion: 2, value: "FACILITY_RESULT:RESOLVED" });
    expect(resolved).toMatchObject({ status: "COMPLETED", outcome: "RESOLVED", version: 3 });
  });

  it("escalates contextual danger even when the reply is only yes", () => {
    const started = startFacilityTriage({ description: "보일러가 고장 났어요", initialMessageId: "message-1" });
    expect(submitFacilityReply({ state: started, expectedVersion: 1, value: "네" })).toMatchObject({ outcome: "EMERGENCY", safetyConfirmed: false });
  });

  it("creates the operator outcome only after troubleshooting is unresolved", () => {
    const started = startFacilityTriage({ description: "에어컨 고장", initialMessageId: "message-1" });
    const safe = submitFacilityReply({ state: started, expectedVersion: 1, value: "없어요" });
    expect(submitFacilityReply({ state: safe, expectedVersion: 2, value: "아직 안 돼요" })).toMatchObject({ outcome: "NEEDS_OPERATOR" });
  });

  it("rejects stale replies", () => {
    const started = startFacilityTriage({ description: "누수", initialMessageId: "message-1" });
    expect(() => submitFacilityReply({ state: started, expectedVersion: 2, value: "없어요" })).toThrow("FACILITY_VERSION_CONFLICT");
  });
});
