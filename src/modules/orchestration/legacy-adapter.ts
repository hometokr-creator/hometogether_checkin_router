import type { ClassificationResult } from "@/modules/classification/schema";
import type { ConversationInterpretation } from "./schema";

const intentMap: Record<ConversationInterpretation["intent"], ClassificationResult["intent"]> = {
  SMALL_TALK: "FEEDBACK",
  LOOKUP_CONTRACT: "QUESTION",
  LOOKUP_PAYMENT: "QUESTION",
  LOOKUP_RULE: "QUESTION",
  LOOKUP_HOME: "QUESTION",
  RECORD_SCHEDULE: "REPORT",
  REPORT_ISSUE: "COMPLAINT",
  FACILITY_REQUEST: "REQUEST",
  MOVE_OUT_CONSIDERATION: "CHANGE",
  EMOTIONAL_SIGNAL: "REPORT",
  EMERGENCY: "EMERGENCY",
  UNKNOWN: "UNKNOWN",
};

export function toLegacyClassification(input: ConversationInterpretation): ClassificationResult {
  const domain: ClassificationResult["domain"] = input.intent === "FACILITY_REQUEST"
    ? "FACILITY"
    : input.intent === "LOOKUP_CONTRACT" || input.intent === "MOVE_OUT_CONSIDERATION"
      ? "CONTRACT"
      : input.intent === "LOOKUP_PAYMENT"
        ? "SETTLEMENT"
        : input.riskFlags.includes("PRIVACY")
          ? "PRIVACY"
          : input.intent === "EMERGENCY"
            ? "SAFETY"
            : "OTHER";
  const riskFlags = input.riskFlags.includes("NONE")
    ? ["NONE" as const]
    : input.riskFlags.map((flag) => flag as Exclude<ClassificationResult["riskFlags"][number], "NONE">);
  return {
    intent: intentMap[input.intent],
    domain,
    severity: input.severity === "S0" ? "S1" : input.severity,
    urgency: input.severity === "S3" ? "IMMEDIATE" : input.severity === "S2" ? "SAME_DAY" : "NORMAL",
    direction: "NOT_APPLICABLE",
    interventionPreference: input.severity === "S3" ? "URGENT" : input.severity === "S0" ? "UNKNOWN" : "COORDINATE",
    distressSignal: input.intent === "EMOTIONAL_SIGNAL" || input.severity === "S3" ? "EXPLICIT" : "NONE",
    riskFlags,
    confidence: input.confidence,
    evidenceMessageIds: ["KAKAO_CURRENT_MESSAGE"],
    reasonCodes: input.reasonCodes,
  };
}
