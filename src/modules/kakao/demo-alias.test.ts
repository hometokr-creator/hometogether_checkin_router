import { describe, expect, it } from "vitest";
import { canUseKakaoDemoAlias } from "./demo-alias";

describe("Kakao demo alias gate", () => {
  it("allows HOMETO only for an explicitly configured demo bot", () => {
    expect(canUseKakaoDemoAlias({ utterance: " hometo ", botId: "bot-1", enabled: "true", allowedBotIds: "bot-1,bot-2" })).toBe(true);
  });

  it.each([
    { utterance: "HOMETO", botId: "bot-1", enabled: "false", allowedBotIds: "bot-1" },
    { utterance: "HOMETO", botId: "prod-bot", enabled: "true", allowedBotIds: "bot-1" },
    { utterance: "someone", botId: "bot-1", enabled: "true", allowedBotIds: "bot-1" },
    { utterance: "HOMETO", botId: null, enabled: "true", allowedBotIds: "bot-1" },
  ])("rejects a request outside the gate", (input) => {
    expect(canUseKakaoDemoAlias(input)).toBe(false);
  });
});
