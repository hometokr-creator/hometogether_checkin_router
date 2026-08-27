import { emptyConversationEntities, type ConversationInterpretation } from "./schema";

type SafetyPattern = {
  terms: readonly string[];
  riskFlags: ConversationInterpretation["riskFlags"];
  reasonCode: string;
};

const safetyPatterns: SafetyPattern[] = [
  { terms: ["불이야", "불났어", "불이 났", "화재", "연기가 나"], riskFlags: ["SAFETY"], reasonCode: "EXPLICIT_FIRE" },
  { terms: ["가스 냄새", "가스가 새", "가스 새는", "가스 누출"], riskFlags: ["SAFETY"], reasonCode: "EXPLICIT_GAS_LEAK" },
  { terms: ["죽고 싶", "자해하고 싶", "목숨을 끊", "나를 해치고 싶"], riskFlags: ["SELF_HARM", "HEALTH"], reasonCode: "EXPLICIT_SELF_HARM" },
  { terms: ["폭행당", "맞고 있어", "칼을 들", "죽이겠다고", "죽인다고 위협"], riskFlags: ["THREAT", "SAFETY"], reasonCode: "EXPLICIT_VIOLENCE" },
];

export function safetyPrecheck(utterance: string): ConversationInterpretation | null {
  const text = utterance.replace(/\s+/g, " ").trim().toLowerCase();
  const matched = safetyPatterns.find((pattern) => pattern.terms.some((term) => text.includes(term)));
  if (!matched) return null;
  return {
    intent: "EMERGENCY",
    severity: "S3",
    riskFlags: matched.riskFlags,
    entities: emptyConversationEntities,
    confidence: 1,
    reasonCodes: ["SAFETY_PRECHECK", matched.reasonCode],
  };
}
