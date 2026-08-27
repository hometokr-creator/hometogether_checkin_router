import type { Route, RoutingDecision } from "@/modules/routing/decide-route";
import type { ConversationInterpretation } from "@/modules/orchestration/schema";

export type ProposedAction = "ANSWER" | "CLARIFY" | "RECORD" | "START_FACILITY_TRIAGE" | "CREATE_ISSUE" | "EMERGENCY_GUIDANCE";

export type ActionDecision = RoutingDecision & {
  action: ProposedAction;
  openIssue: boolean;
};

function decision(action: ProposedAction, route: Route, openIssue: boolean, immediateAlert: boolean, reasonCodes: string[]): ActionDecision {
  return { action, route, openIssue, immediateAlert, reasonCodes };
}

export function decideAction(interpretation: ConversationInterpretation, clarifyThreshold = 0.85): ActionDecision {
  if (interpretation.intent === "EMERGENCY" || interpretation.severity === "S3") {
    return decision("EMERGENCY_GUIDANCE", "B", true, true, ["SAFETY_GUIDANCE_REQUIRED", ...interpretation.reasonCodes]);
  }
  if (interpretation.confidence < clarifyThreshold || interpretation.intent === "UNKNOWN") {
    return decision("CLARIFY", "A", false, false, ["MEANING_CONFIRMATION_REQUIRED", ...interpretation.reasonCodes]);
  }
  if (interpretation.intent === "SMALL_TALK") {
    return decision("ANSWER", "A", false, false, ["SMALL_TALK_NO_ISSUE"]);
  }
  if (interpretation.intent.startsWith("LOOKUP_")) {
    return decision("CLARIFY", "A", false, false, ["STRUCTURED_GROUNDING_REQUIRED"]);
  }
  if (interpretation.intent === "RECORD_SCHEDULE") {
    return decision("RECORD", "A", false, false, ["SCHEDULE_RECORD_REQUEST"]);
  }
  if (interpretation.intent === "FACILITY_REQUEST") {
    return decision("START_FACILITY_TRIAGE", "A", false, false, ["FACILITY_SAFETY_GATE_REQUIRED"]);
  }
  return decision("CREATE_ISSUE", "B", true, false, ["OPERATOR_REVIEW_REQUIRED"]);
}
