import type { ConversationInterpretation } from "@/modules/orchestration/schema";

export type MessageAccessLevel = "A" | "B" | "C";

export function decideMessageAccess(interpretation: ConversationInterpretation): MessageAccessLevel {
  if (interpretation.severity === "S2" || interpretation.severity === "S3") return "C";
  if (interpretation.riskFlags.some((flag) => flag === "PRIVACY" || flag === "THREAT" || flag === "SELF_HARM")) return "C";
  return "A";
}
