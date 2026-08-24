import type { ClassificationResult } from "./schema";

const includesAny = (text: string, terms: readonly string[]) => terms.some((term) => text.includes(term));

export function classifyInboundMessage(utterance: string): ClassificationResult {
  const text = utterance.trim().toLowerCase();
  const base = {
    evidenceMessageIds: ["KAKAO_CURRENT_MESSAGE"],
    reasonCodes: ["DETERMINISTIC_V0_CLASSIFIER"],
  };

  if (includesAny(text, ["불이야", "화재", "가스 냄새", "죽고 싶", "자해", "폭행", "위협"])) {
    return { ...base, intent: "EMERGENCY", domain: "SAFETY", severity: "S3", urgency: "IMMEDIATE", direction: "NOT_APPLICABLE", interventionPreference: "URGENT", distressSignal: "EXPLICIT", riskFlags: ["SAFETY"], confidence: 0.99 };
  }
  if (includesAny(text, ["고장", "누수", "물이 새", "보일러", "에어컨", "전기", "시설"])) {
    return { ...base, intent: "REQUEST", domain: "FACILITY", severity: "S1", urgency: "NORMAL", direction: "NOT_APPLICABLE", interventionPreference: "COORDINATE", distressSignal: "NONE", riskFlags: ["NONE"], confidence: 0.9 };
  }
  if (includesAny(text, ["소음", "시끄", "tv 소리", "티비 소리", "잠을 못", "쿵쿵"])) {
    return { ...base, intent: "COMPLAINT", domain: "NOISE", severity: "S2", urgency: "SAME_DAY", direction: "G_TO_H", interventionPreference: "COORDINATE", distressSignal: includesAny(text, ["잠을 못", "힘들", "불편"]) ? "EXPLICIT" : "POSSIBLE", riskFlags: ["NONE"], confidence: 0.94 };
  }
  if (includesAny(text, ["주방", "요리", "취사"])) {
    return { ...base, intent: "QUESTION", domain: "KITCHEN", severity: "S1", urgency: "NORMAL", direction: "NOT_APPLICABLE", interventionPreference: "UNKNOWN", distressSignal: "NONE", riskFlags: ["NONE"], confidence: 0.95 };
  }
  if (includesAny(text, ["계약", "퇴거", "해지", "보증금"])) {
    return { ...base, intent: "QUESTION", domain: "CONTRACT", severity: "S1", urgency: "NORMAL", direction: "NOT_APPLICABLE", interventionPreference: "UNKNOWN", distressSignal: "NONE", riskFlags: includesAny(text, ["보증금"]) ? ["MONEY"] : ["NONE"], confidence: 0.9 };
  }
  if (includesAny(text, ["정산", "전기요금", "관리비", "서비스료", "비용"])) {
    return { ...base, intent: "QUESTION", domain: "SETTLEMENT", severity: "S1", urgency: "NORMAL", direction: "NOT_APPLICABLE", interventionPreference: "UNKNOWN", distressSignal: "NONE", riskFlags: ["MONEY"], confidence: 0.9 };
  }
  return { ...base, intent: "UNKNOWN", domain: "OTHER", severity: "S1", urgency: "NORMAL", direction: "NOT_APPLICABLE", interventionPreference: "UNKNOWN", distressSignal: "NONE", riskFlags: ["NONE"], confidence: 0.4 };
}

export function calculateTicketDueAt(urgency: ClassificationResult["urgency"], now: Date) {
  const hours = urgency === "IMMEDIATE" ? 1 : urgency === "SAME_DAY" ? 8 : 24;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}
