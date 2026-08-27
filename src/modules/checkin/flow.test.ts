import { describe, expect, it } from "vitest";
import { startCheckin, submitCheckinAnswer } from "./flow";
import type { CheckinTemplate } from "./template-schema";

const template: CheckinTemplate = {
  id: "D3-V1",
  questions: [
    { key: "overall", type: "SINGLE_CHOICE", prompt: "전반적으로 어떠세요?", options: [
      { value: "GOOD", label: "잘 지내요", signal: "NONE" },
      { value: "HELP", label: "즉시 도움이 필요해요", signal: "EMERGENCY" },
    ] },
    { key: "facility", type: "SINGLE_CHOICE", prompt: "시설은 어떠세요?", options: [
      { value: "OK", label: "문제없어요", signal: "NONE" },
      { value: "REPAIR", label: "수리가 필요해요", signal: "REVIEW" },
    ] },
    { key: "free_text", type: "FREE_TEXT", prompt: "추가 내용이 있나요?" },
  ],
};

function answer(state: ReturnType<typeof startCheckin>, questionKey: string, value: string) {
  return submitCheckinAnswer({ template, state, expectedVersion: state.version, questionKey, value });
}

describe("checkin flow", () => {
  it("advances in template order and completes", () => {
    let state = startCheckin(template);
    expect(state.currentQuestionKey).toBe("overall");
    state = answer(state, "overall", "GOOD");
    state = answer(state, "facility", "OK");
    state = answer(state, "free_text", "없어요");
    expect(state.status).toBe("COMPLETED");
    expect(state.currentQuestionKey).toBeNull();
    expect(state.disposition).toBe("OK");
    expect(state.answers).toEqual({ overall: "GOOD", facility: "OK", free_text: "없어요" });
  });

  it("preserves emergency as the highest-priority disposition", () => {
    let state = startCheckin(template);
    state = answer(state, "overall", "HELP");
    state = answer(state, "facility", "OK");
    state = answer(state, "free_text", "없어요");
    expect(state.disposition).toBe("EMERGENCY");
  });

  it("marks non-empty free text for classification", () => {
    let state = startCheckin(template);
    state = answer(state, "overall", "GOOD");
    state = answer(state, "facility", "OK");
    state = answer(state, "free_text", "와이파이가 가끔 끊겨요");
    expect(state.disposition).toBe("NEEDS_CLASSIFICATION");
  });

  it("rejects stale, out-of-order, and invalid answers", () => {
    const state = startCheckin(template);
    expect(() => submitCheckinAnswer({ template, state, expectedVersion: 0, questionKey: "overall", value: "GOOD" })).toThrow("CHECKIN_VERSION_CONFLICT");
    expect(() => submitCheckinAnswer({ template, state, expectedVersion: 1, questionKey: "facility", value: "OK" })).toThrow("CHECKIN_UNEXPECTED_QUESTION");
    expect(() => submitCheckinAnswer({ template, state, expectedVersion: 1, questionKey: "overall", value: "UNKNOWN" })).toThrow("CHECKIN_INVALID_OPTION");
  });

  it("rejects duplicate answers after completion", () => {
    let state = startCheckin(template);
    state = answer(state, "overall", "GOOD");
    state = answer(state, "facility", "OK");
    state = answer(state, "free_text", "없어요");
    expect(() => submitCheckinAnswer({ template, state, expectedVersion: state.version, questionKey: "free_text", value: "없어요" })).toThrow("CHECKIN_ALREADY_COMPLETED");
  });
});
