import { describe, expect, it } from "vitest";
import {
  extractLinkingToken,
  getKakaoProviderUserKey,
  kakaoSimpleText,
  kakaoSkillPayloadSchema,
} from "./skill";

const payload = {
  userRequest: {
    utterance: "요즘 밤마다 TV 소리가 커요.",
    block: { id: "block-1", name: "폴백" },
    user: {
      id: "bot-user-key",
      type: "botUserKey",
      properties: { plusfriendUserKey: "channel-user-key" },
    },
  },
  bot: { id: "bot-1", name: "홈투게더" },
  action: { id: "skill-1", name: "inbound" },
};

describe("Kakao skill adapter", () => {
  it("parses the official SkillPayload shape", () => {
    expect(kakaoSkillPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("prefers the channel user key when Kakao supplies it", () => {
    const parsed = kakaoSkillPayloadSchema.parse(payload);
    expect(getKakaoProviderUserKey(parsed)).toBe("channel-user-key");
  });

  it("falls back to the bot-scoped user id", () => {
    const parsed = kakaoSkillPayloadSchema.parse({
      ...payload,
      userRequest: { ...payload.userRequest, user: { id: "bot-user-key" } },
    });
    expect(getKakaoProviderUserKey(parsed)).toBe("bot-user-key");
  });

  it("builds a Kakao 2.0 simpleText response", () => {
    expect(kakaoSimpleText("접수했어요.")).toEqual({
      version: "2.0",
      template: { outputs: [{ simpleText: { text: "접수했어요." } }] },
    });
  });

  it("recognizes a raw or labeled 43-character linking token", () => {
    const token = "a".repeat(43);
    expect(extractLinkingToken(token)).toBe(token);
    expect(extractLinkingToken(`연결코드: ${token}`)).toBe(token);
    expect(extractLinkingToken(`연결 토큰 ${token}`)).toBe(token);
  });

  it("does not treat ordinary messages as linking tokens", () => {
    expect(extractLinkingToken("안녕하세요")).toBeNull();
    expect(extractLinkingToken("a".repeat(42))).toBeNull();
    expect(extractLinkingToken(`연결코드 ${"!".repeat(43)}`)).toBeNull();
  });
});
