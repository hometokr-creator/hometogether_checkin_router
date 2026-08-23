import type { AgreementStatus, ClassificationResult } from "../classification/schema";
export type Route = "A" | "B" | "C";
export interface RoutingDecision { route: Route; reasonCodes: string[]; immediateAlert: boolean }
const criticalRisks = new Set(["SAFETY", "HEALTH", "THREAT", "SELF_HARM", "LEGAL"]);
const groundedDomains = new Set(["FAQ", "CONTRACT", "SETTLEMENT", "KITCHEN"]);
export function decideRoute(c: ClassificationResult, agreement: AgreementStatus, threshold = 0.8): RoutingDecision {
  if (c.confidence < threshold) return { route: "B", reasonCodes: ["LOW_CONFIDENCE"], immediateAlert: false };
  if (c.riskFlags.some((flag) => criticalRisks.has(flag))) return { route: "B", reasonCodes: ["CRITICAL_RISK"], immediateAlert: true };
  if (c.domain === "FACILITY") return { route: "C", reasonCodes: ["FACILITY_SAFETY_GATE_PASSED"], immediateAlert: false };
  if (c.distressSignal !== "NONE" || c.severity !== "S1" || c.direction !== "NOT_APPLICABLE") return { route: "B", reasonCodes: ["HUMAN_COORDINATION_REQUIRED"], immediateAlert: false };
  if (groundedDomains.has(c.domain) && agreement === "CLAUSE_EXISTS") return { route: "A", reasonCodes: ["GROUNDED_S1_LOOKUP"], immediateAlert: false };
  return { route: "B", reasonCodes: [agreement === "CONFLICTING_CLAUSES" ? "CONFLICTING_EVIDENCE" : "GROUNDING_REQUIRED"], immediateAlert: false };
}
