import type { ClassificationResult } from "@/modules/classification/schema";
import type { StructuredLookupRequest } from "./structured-lookup";

export function classifyStructuredLookup(request: StructuredLookupRequest): ClassificationResult {
  const domain = request.type === "CONTRACT_END"
    ? "CONTRACT"
    : request.type === "MONTHLY_PAYMENT" || request.type === "NEXT_PAYMENT"
      ? "SETTLEMENT"
      : request.category === "kitchen"
        ? "KITCHEN"
        : "FAQ";

  return {
    intent: "QUESTION",
    domain,
    severity: "S1",
    urgency: "NORMAL",
    direction: "NOT_APPLICABLE",
    interventionPreference: "UNKNOWN",
    distressSignal: "NONE",
    riskFlags: ["NONE"],
    confidence: 1,
    evidenceMessageIds: ["KAKAO_CURRENT_MESSAGE"],
    reasonCodes: ["DETERMINISTIC_STRUCTURED_LOOKUP"],
  };
}
