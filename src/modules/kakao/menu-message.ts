export const KAKAO_MAIN_MENU_ITEMS = ["계약관련 질문", "문제 접수", "생활 규칙", "월세/보증금 정산"] as const;

export function kakaoLinkedMenuMessage() {
  return {
    version: "2.0" as const,
    template: {
      outputs: [{ simpleText: { text: "안녕하세요 게스트님. 회원이 확인되었습니다.\n\n무엇을 도와드릴까요?" } }],
      quickReplies: KAKAO_MAIN_MENU_ITEMS.map((label) => ({ label, action: "message" as const, messageText: label })),
    },
  };
}

export function kakaoCheckinMenuMessage() {
  return {
    version: "2.0" as const,
    template: {
      outputs: [{ simpleText: { text: "입주 3일차 정기 체크인을 시작할게요." } }],
      quickReplies: [{ label: "체크인 시작", action: "message" as const, messageText: "정기 체크인 시작" }],
    },
  };
}
