import { describe, expect, it } from "vitest";
import { interpretConversationDeterministically } from "./interpret-conversation";

describe("deterministic conversation interpretation", () => {
  it("keeps greetings out of the issue path", () => {
    expect(interpretConversationDeterministically("안녕하세요")).toMatchObject({ intent: "SMALL_TALK", severity: "S0", confidence: 0.99 });
  });

  it("treats room intrusion as a private S2 report", () => {
    expect(interpretConversationDeterministically("허락 없이 제 방에 들어왔어요")).toMatchObject({ intent: "REPORT_ISSUE", severity: "S2", riskFlags: ["PRIVACY"] });
  });

  it("asks to disambiguate residence distress instead of declaring self-harm", () => {
    expect(interpretConversationDeterministically("어후 여기 살기 싫어요")).toMatchObject({ intent: "EMOTIONAL_SIGNAL", confidence: 0.72, riskFlags: ["NONE"] });
  });
});
