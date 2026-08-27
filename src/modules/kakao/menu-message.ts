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

type MenuPrompt = {
  text: string;
  replies: readonly { label: string; messageText: string }[];
};

const MENU_PROMPTS: Record<string, MenuPrompt> = {
  계약관련질문: {
    text: "계약에 관해 무엇을 확인할까요?",
    replies: [
      { label: "계약 종료일", messageText: "계약은 언제까지인가요?" },
      { label: "월 정기 납부액", messageText: "월세와 관리비는 얼마인가요?" },
      { label: "다음 납부일", messageText: "다음 납부일은 언제인가요?" },
    ],
  },
  문제접수: {
    text: "어떤 문제가 생겼는지 선택하거나, 현재 상황을 한 문장으로 자세히 적어 주세요.",
    replies: [
      { label: "시설 고장", messageText: "시설 고장을 접수하고 싶어요" },
      { label: "생활 불편", messageText: "생활 불편 문제가 있어요" },
      { label: "긴급 문제", messageText: "긴급한 문제가 있어요" },
    ],
  },
  생활규칙: {
    text: "어떤 생활 규칙을 확인할까요?",
    replies: [
      { label: "세탁 가능 시간", messageText: "세탁 가능한 시간이 언제인가요?" },
      { label: "정숙 시간", messageText: "조용한 시간은 언제인가요?" },
      { label: "주방 이용", messageText: "주방 이용 규칙을 알려주세요" },
      { label: "방문객 규칙", messageText: "방문객 규칙을 알려주세요" },
    ],
  },
  월세보증금정산: {
    text: "어떤 정산 정보를 확인할까요?",
    replies: [
      { label: "월 정기 납부액", messageText: "월세와 관리비는 얼마인가요?" },
      { label: "다음 납부일", messageText: "다음 납부일은 언제인가요?" },
      { label: "보증금 정산", messageText: "보증금 정산에 대해 문의할게요" },
    ],
  },
};

export function kakaoSelectedMenuMessage(utterance: string) {
  const key = utterance.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/[\s/]+/g, "").toLowerCase();
  const prompt = MENU_PROMPTS[key];
  if (!prompt) return null;

  return {
    version: "2.0" as const,
    template: {
      outputs: [{ simpleText: { text: prompt.text } }],
      quickReplies: prompt.replies.map(({ label, messageText }) => ({ label, action: "message" as const, messageText })),
    },
  };
}
