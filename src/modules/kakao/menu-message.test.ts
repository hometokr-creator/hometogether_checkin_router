import { describe, expect, it } from "vitest";
import { kakaoSelectedMenuMessage } from "./menu-message";

describe("Kakao selected menu messages", () => {
  it.each([
    ["계약관련 질문", "계약에 관해", 3],
    ["문제 접수", "어떤 문제가", 3],
    ["생활 규칙", "어떤 생활 규칙", 4],
    ["월세/보증금 정산", "어떤 정산 정보", 3],
  ] as const)("guides the next response for %s", (utterance, expectedText, replyCount) => {
    const response = kakaoSelectedMenuMessage(utterance);
    expect(response?.template.outputs[0].simpleText.text).toContain(expectedText);
    expect(response?.template.quickReplies).toHaveLength(replyCount);
  });

  it("ignores an ordinary free-form message", () => {
    expect(kakaoSelectedMenuMessage("보일러에서 물이 새요")).toBeNull();
  });
});
