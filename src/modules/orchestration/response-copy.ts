import type { ActionDecision } from "@/modules/policy/decide-action";
import type { ConversationInterpretation } from "./schema";

export function buildActionResponse(interpretation: ConversationInterpretation, decision: ActionDecision) {
  if (decision.action === "EMERGENCY_GUIDANCE") {
    if (interpretation.riskFlags.includes("SELF_HARM")) {
      return "지금 혼자 감당하지 않으셔도 돼요. 당장 자신을 해칠 가능성이 있다면 위험한 물건에서 떨어져 가까운 사람에게 알리고 112 또는 119에 연락해 주세요. 홈투게더 운영팀에도 긴급 확인이 필요하다고 기록할게요.";
    }
    if (interpretation.reasonCodes.includes("EXPLICIT_GAS_LEAK")) {
      return "가스 기기나 전기 스위치를 조작하지 말고, 가능하면 문을 열어 환기한 뒤 즉시 집 밖 안전한 곳으로 이동해 주세요. 안전한 곳에서 119에 직접 신고해 주세요. 운영팀에도 긴급 확인이 필요하다고 기록할게요.";
    }
    return "즉시 위험하다면 현장에서 벗어나 안전한 장소로 이동하고 112 또는 119에 직접 연락해 주세요. 운영팀에도 긴급 확인이 필요하다고 기록할게요.";
  }
  if (decision.action === "ANSWER") return "안녕하세요. 계약·납부·생활규칙 조회나 거주 중 불편 사항을 말씀해 주세요.";
  if (decision.action === "CLARIFY" && interpretation.intent === "EMOTIONAL_SIGNAL") {
    return "말씀하신 내용이 지금 집에서 계속 지내기 어렵다는 뜻인지, 본인을 해칠 생각이 든다는 뜻인지 확인하고 싶어요. 지금 즉시 위험하다면 112 또는 119에 연락해 주세요.";
  }
  if (decision.action === "CLARIFY") {
    return "어떤 도움이 필요한지 조금만 더 알려주세요. 계약·납부·생활규칙 조회인지, 시설 문제나 생활 불편 접수인지 말씀해 주시면 이어서 도와드릴게요.";
  }
  if (decision.action === "RECORD") return "일정 내용을 기록하기 전에 날짜와 시간을 한 번 더 확인해 주세요.";
  return "말씀해 주신 내용을 비공개로 접수했어요. 담당자가 확인할 수 있도록 기록해 둘게요.";
}
