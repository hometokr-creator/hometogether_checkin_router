import { describe, expect, it } from "vitest";
import { safetyPrecheck } from "./safety-precheck";

describe("safety precheck", () => {
  it.each([
    ["지금 가스 냄새가 나요", "EXPLICIT_GAS_LEAK"],
    ["주방에 불이 났어요", "EXPLICIT_FIRE"],
    ["지금 죽고 싶어요", "EXPLICIT_SELF_HARM"],
    ["상대가 칼을 들고 있어요", "EXPLICIT_VIOLENCE"],
  ])("promotes explicit danger: %s", (utterance, reasonCode) => {
    expect(safetyPrecheck(utterance)).toMatchObject({ intent: "EMERGENCY", severity: "S3", confidence: 1 });
    expect(safetyPrecheck(utterance)?.reasonCodes).toContain(reasonCode);
  });

  it.each(["가스레인지 사용 규칙 알려줘", "어후 여기 살기 싫어요", "불고기 해도 돼요?"])("does not over-trigger: %s", (utterance) => {
    expect(safetyPrecheck(utterance)).toBeNull();
  });
});
