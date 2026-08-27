import { describe, expect, it } from "vitest";
import { startCheckin, submitCheckinAnswer } from "./flow";
import { presentCheckin } from "./presentation";

const template = {
  id: "template-1",
  questions: [
    {
      key: "overall",
      type: "SINGLE_CHOICE" as const,
      prompt: "어떠세요?",
      options: [
        { value: "GOOD", label: "좋아요", signal: "NONE" as const },
        { value: "HELP", label: "도움이 필요해요", signal: "REVIEW" as const },
      ],
    },
    { key: "memo", type: "FREE_TEXT" as const, prompt: "더 하실 말씀이 있나요?" },
  ],
};

describe("checkin presentation", () => {
  it("omits internal signals and exposes progress", () => {
    const result = presentCheckin(template, startCheckin(template));
    expect(result).toMatchObject({ status: "WAITING_USER", step: 1, totalSteps: 2 });
    expect(result.question).toEqual({
      key: "overall",
      type: "SINGLE_CHOICE",
      prompt: "어떠세요?",
      options: [{ value: "GOOD", label: "좋아요" }, { value: "HELP", label: "도움이 필요해요" }],
    });
  });

  it("returns no question after completion", () => {
    const first = startCheckin(template);
    const second = submitCheckinAnswer({ template, state: first, expectedVersion: 1, questionKey: "overall", value: "GOOD" });
    const completed = submitCheckinAnswer({ template, state: second, expectedVersion: 2, questionKey: "memo", value: "없어요" });
    expect(presentCheckin(template, completed)).toMatchObject({ status: "COMPLETED", step: 2, question: null });
  });
});
