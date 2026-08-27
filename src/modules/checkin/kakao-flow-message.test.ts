import { describe, expect, it } from "vitest";
import { kakaoCheckinFlowMessage } from "./kakao-flow-message";

describe("Kakao check-in flow message", () => {
  it("uses user-readable labels as message quick replies", () => {
    const result = kakaoCheckinFlowMessage({
      checkin: {
        status: "WAITING_USER",
        version: 1,
        step: 1,
        totalSteps: 4,
        disposition: "OK",
        question: {
          key: "overall",
          type: "SINGLE_CHOICE",
          prompt: "전반적으로 어떠세요?",
          options: [{ value: "GOOD", label: "잘 지내고 있어요" }, { value: "HELP", label: "도움이 필요해요" }],
        },
      },
    });
    expect(result.version).toBe("2.0");
    expect(result.template.quickReplies).toEqual([
      { label: "잘 지내고 있어요", action: "message", messageText: "잘 지내고 있어요" },
      { label: "도움이 필요해요", action: "message", messageText: "도움이 필요해요" },
    ]);
  });

  it("returns the existing main menu after completion", () => {
    const result = kakaoCheckinFlowMessage({
      checkin: { status: "COMPLETED", version: 5, step: 4, totalSteps: 4, disposition: "OK", question: null },
    });
    expect(result.template.quickReplies.map((reply) => reply.label)).toEqual(["계약관련 질문", "문제 접수", "생활 규칙", "월세/보증금 정산"]);
  });
});
