import { describe, expect, it } from "vitest";
import { calculateTicketDueAt, classifyInboundMessage } from "./classify-inbound";

describe("deterministic inbound classification", () => {
  it("classifies the HH-002 noise complaint", () => {
    const result = classifyInboundMessage("밤마다 TV 소리가 커서 잠을 못 자겠어요.");
    expect(result).toMatchObject({ domain: "NOISE", severity: "S2", urgency: "SAME_DAY", confidence: 0.94 });
  });
  it("routes obvious facility language to the facility domain", () => {
    expect(classifyInboundMessage("보일러가 고장 났어요")).toMatchObject({ domain: "FACILITY", intent: "REQUEST" });
  });
  it("fails closed for unrecognized messages", () => {
    expect(classifyInboundMessage("안녕하세요")).toMatchObject({ domain: "OTHER", confidence: 0.4 });
  });
  it("recognizes a grounded kitchen-hours question", () => {
    expect(classifyInboundMessage("주방은 몇 시까지 써도 돼요?")).toMatchObject({ intent: "QUESTION", domain: "KITCHEN", severity: "S1" });
  });
  it("sets deterministic SLA deadlines", () => {
    const now = new Date("2026-08-24T00:00:00.000Z");
    expect(calculateTicketDueAt("IMMEDIATE", now).toISOString()).toBe("2026-08-24T01:00:00.000Z");
    expect(calculateTicketDueAt("SAME_DAY", now).toISOString()).toBe("2026-08-24T08:00:00.000Z");
  });
});
