import { describe, expect, it } from "vitest";
import { createSignalQuestionMessage, parseSignalReply } from "../checkin/kakao-message";
import { decideInboundAccess } from "./inbound-access";
import { planCheckinDelivery } from "./plan-checkin-delivery";

describe("Kakao channel policy", () => {
  it("uses Event API only for an active linked channel friend", () => {
    expect(planCheckinDelivery({ activeContract: true, linkedUserKey: true, reachability: "FRIEND_ACTIVE" })).toMatchObject({ allowed: true, channel: "EVENT_API" });
    expect(planCheckinDelivery({ activeContract: true, linkedUserKey: false, reachability: "NOT_LINKED" }).channel).not.toBe("EVENT_API");
  });
  it("uses only an approved informational Alimtalk fallback", () => {
    expect(planCheckinDelivery({ activeContract: true, linkedUserKey: true, reachability: "DELIVERY_FAILED", eventApiFailed: true, approvedInformationalTemplate: true }).channel).toBe("ALIMTALK");
    expect(planCheckinDelivery({ activeContract: true, linkedUserKey: true, reachability: "DELIVERY_FAILED", eventApiFailed: true }).channel).toBe("OPERATOR_PHONE");
  });
  it("limits unlinked users and blocks identity conflicts", () => {
    expect(decideInboundAccess("UNLINKED")).toBe("PUBLIC_FAQ_ONLY");
    expect(decideInboundAccess("CONFLICT")).toBe("HUMAN_REVIEW");
    expect(decideInboundAccess("LINKED")).toBe("HOUSEHOLD_LEDGER");
  });
  it("creates one native quick-reply question at a time", () => {
    const message = createSignalQuestionMessage({ questionId: "T1", prompt: "청소·위생은 어떠세요?" });
    expect(message.template.outputs).toHaveLength(1);
    expect(message.template.quickReplies).toHaveLength(3);
    expect(parseSignalReply("T1:YELLOW")).toEqual({ questionId: "T1", signal: "YELLOW" });
    expect(parseSignalReply("자유 입력")).toBeNull();
  });
});
