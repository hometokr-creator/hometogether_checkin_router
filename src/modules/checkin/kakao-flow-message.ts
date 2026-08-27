import type { CheckinPresentation } from "./presentation";
import { KAKAO_MAIN_MENU_ITEMS } from "@/modules/kakao/menu-message";

const completionText: Record<CheckinPresentation["disposition"], string> = {
  OK: "체크인이 완료됐어요. 초기 적응 상태를 양호로 기록했습니다.",
  NEEDS_CLASSIFICATION: "체크인이 완료됐어요. 남겨주신 내용을 운영팀이 확인할 수 있도록 기록했습니다.",
  NEEDS_REVIEW: "체크인이 완료됐어요. 불편 사항은 운영팀 검토 대상으로 기록했습니다.",
  EMERGENCY: "안전 관련 응답을 확인했어요. 즉시 위험하다면 안전한 장소로 이동하고 112 또는 119에 직접 연락해 주세요.",
};

export function kakaoCheckinFlowMessage(input: { checkin: CheckinPresentation; prefix?: string; correction?: string }) {
  const question = input.checkin.question;
  const text = question
    ? [input.prefix, input.correction, `${input.checkin.step}/${input.checkin.totalSteps} · ${question.prompt}`].filter(Boolean).join("\n\n")
    : completionText[input.checkin.disposition];
  const quickReplies = question?.type === "SINGLE_CHOICE"
    ? (question.options ?? []).map((option) => ({ label: option.label, action: "message" as const, messageText: option.label }))
    : question
      ? [{ label: "특별히 없어요", action: "message" as const, messageText: "없어요" }]
      : KAKAO_MAIN_MENU_ITEMS.map((label) => ({ label, action: "message" as const, messageText: label }));
  return {
    version: "2.0" as const,
    template: { outputs: [{ simpleText: { text } }], quickReplies },
  };
}
