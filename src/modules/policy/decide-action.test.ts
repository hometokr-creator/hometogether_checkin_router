import { describe, expect, it } from "vitest";
import { interpretConversationDeterministically } from "@/modules/orchestration/interpret-conversation";
import { decideAction } from "./decide-action";

describe("conversation action policy", () => {
  it("answers small talk without opening an issue", () => {
    expect(decideAction(interpretConversationDeterministically("안녕하세요"))).toMatchObject({ action: "ANSWER", route: "A", openIssue: false });
  });

  it("uses one clarification for ambiguous distress", () => {
    expect(decideAction(interpretConversationDeterministically("여기 살기 싫어요"))).toMatchObject({ action: "CLARIFY", openIssue: false });
  });

  it("creates an operator issue and immediate alert for explicit danger", () => {
    expect(decideAction(interpretConversationDeterministically("가스 냄새가 나요"))).toMatchObject({ action: "EMERGENCY_GUIDANCE", route: "B", openIssue: true, immediateAlert: true });
  });

  it("starts triage instead of routing a facility report directly to a partner", () => {
    expect(decideAction(interpretConversationDeterministically("보일러가 고장 났어요"))).toMatchObject({ action: "START_FACILITY_TRIAGE", route: "A", openIssue: false });
  });
});
