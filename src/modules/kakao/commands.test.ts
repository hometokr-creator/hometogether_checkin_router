import { describe, expect, it } from "vitest";
import { kakaoSkillPayloadSchema } from "./skill";
import { isKakaoCheckinStart } from "./commands";

function payload(input: { utterance: string; blockName?: string; command?: string }) {
  return kakaoSkillPayloadSchema.parse({
    userRequest: { utterance: input.utterance, user: { id: "user-1" }, block: input.blockName ? { id: "block-1", name: input.blockName } : undefined },
    bot: { id: "bot-1" },
    action: input.command ? { id: "action-1", params: { command: input.command } } : undefined,
  });
}

describe("Kakao commands", () => {
  it.each([
    payload({ utterance: "정기 체크인 시작" }),
    payload({ utterance: "아무 발화", blockName: "정기 체크인" }),
    payload({ utterance: "아무 발화", command: "START_CHECKIN" }),
  ])("detects the existing check-in block", (input) => {
    expect(isKakaoCheckinStart(input)).toBe(true);
  });
});
