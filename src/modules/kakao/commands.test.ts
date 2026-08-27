import { describe, expect, it } from "vitest";
import { kakaoSkillPayloadSchema } from "./skill";
import { isKakaoCheckinStart, isKakaoMainMenuStart } from "./commands";

function payload(input: { utterance: string; blockName?: string; command?: string }) {
  return kakaoSkillPayloadSchema.parse({
    userRequest: { utterance: input.utterance, user: { id: "user-1" }, block: input.blockName ? { id: "block-1", name: input.blockName } : undefined },
    bot: { id: "bot-1" },
    action: input.command ? { id: "action-1", params: { command: input.command } } : undefined,
  });
}

describe("Kakao commands", () => {
  it.each([
    payload({ utterance: "안녕" }),
    payload({ utterance: "안녕하세요!" }),
    payload({ utterance: "처음으로" }),
    payload({ utterance: "메뉴" }),
    payload({ utterance: "아무 발화", command: "SHOW_MAIN_MENU" }),
  ])("detects a repeatable main-menu start", (input) => {
    expect(isKakaoMainMenuStart(input)).toBe(true);
  });

  it("does not treat an ordinary inquiry as a main-menu start", () => {
    expect(isKakaoMainMenuStart(payload({ utterance: "보일러가 고장났어요" }))).toBe(false);
  });

  it.each(["계약관련 질문", "문제 접수", "생활 규칙", "월세/보증금 정산"])(
    "does not mistake the selected menu for a start command: %s",
    (utterance) => {
      expect(isKakaoMainMenuStart(payload({ utterance, blockName: "메인 메뉴" }))).toBe(false);
    },
  );

  it.each([
    payload({ utterance: "정기 체크인 시작" }),
    payload({ utterance: "아무 발화", blockName: "정기 체크인" }),
    payload({ utterance: "아무 발화", command: "START_CHECKIN" }),
  ])("detects the existing check-in block", (input) => {
    expect(isKakaoCheckinStart(input)).toBe(true);
  });
});
