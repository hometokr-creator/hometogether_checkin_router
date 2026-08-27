import { describe, expect, it } from "vitest";
import { interpretConversationDeterministically } from "./interpret-conversation";
import { toLegacyClassification } from "./legacy-adapter";

describe("legacy classification adapter", () => {
  it("preserves emergency risk for existing persistence", () => {
    expect(toLegacyClassification(interpretConversationDeterministically("지금 가스 냄새가 나요"))).toMatchObject({
      intent: "EMERGENCY",
      domain: "SAFETY",
      severity: "S3",
      urgency: "IMMEDIATE",
    });
  });
});
