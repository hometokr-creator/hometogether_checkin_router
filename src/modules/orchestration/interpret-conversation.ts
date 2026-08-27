import { emptyConversationEntities, type ConversationInterpretation } from "./schema";
import { safetyPrecheck } from "./safety-precheck";

const includesAny = (text: string, terms: readonly string[]) => terms.some((term) => text.includes(term));

export function interpretConversationDeterministically(utterance: string): ConversationInterpretation {
  const safety = safetyPrecheck(utterance);
  if (safety) return safety;

  const text = utterance.replace(/\s+/g, " ").trim().toLowerCase();
  const base = { entities: emptyConversationEntities, riskFlags: ["NONE"] as ConversationInterpretation["riskFlags"] };

  if (/^(안녕|안녕하세요|고마워|감사|감사합니다|수고하세요)[!.?\s]*$/.test(text)) {
    return { ...base, intent: "SMALL_TALK", severity: "S0", confidence: 0.99, reasonCodes: ["DETERMINISTIC_SMALL_TALK"] };
  }
  if (includesAny(text, ["허락 없이 제 방", "허락없이 제 방", "몰래 제 방", "방에 들어왔", "사생활 침해"])) {
    return { ...base, intent: "REPORT_ISSUE", severity: "S2", riskFlags: ["PRIVACY"], confidence: 0.98, reasonCodes: ["EXPLICIT_PRIVACY_REPORT"] };
  }
  if (includesAny(text, ["살기 싫", "여기 못 살겠", "집을 나가고 싶"])) {
    return { ...base, intent: "EMOTIONAL_SIGNAL", severity: "S2", confidence: 0.72, reasonCodes: ["AMBIGUOUS_RESIDENCE_DISTRESS"] };
  }
  if (includesAny(text, ["퇴거", "계약 해지", "이사하고 싶", "계약 끝내고 싶"])) {
    return { ...base, intent: "MOVE_OUT_CONSIDERATION", severity: "S2", confidence: 0.94, reasonCodes: ["MOVE_OUT_LANGUAGE"] };
  }
  if (includesAny(text, ["고장", "누수", "물이 새", "보일러", "에어컨", "전기가 안", "와이파이가 안", "도어록"])) {
    const facility = ["보일러", "에어컨", "와이파이", "도어록"].find((candidate) => text.includes(candidate)) ?? null;
    return { ...base, intent: "FACILITY_REQUEST", severity: "S1", entities: { ...emptyConversationEntities, facility }, confidence: 0.93, reasonCodes: ["EXPLICIT_FACILITY_REQUEST"] };
  }
  if (includesAny(text, ["시끄", "소음", "티비 소리", "tv 소리", "잠을 못", "불편해", "문제가 있어"])) {
    return { ...base, intent: "REPORT_ISSUE", severity: includesAny(text, ["반복", "계속", "잠을 못"]) ? "S2" : "S1", confidence: 0.91, reasonCodes: ["EXPLICIT_RESIDENCE_ISSUE"] };
  }

  return { ...base, intent: "UNKNOWN", severity: "S0", confidence: 0.4, reasonCodes: ["NO_DETERMINISTIC_INTENT"] };
}
