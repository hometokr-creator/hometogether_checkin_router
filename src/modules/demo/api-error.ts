import { NextResponse } from "next/server";

const errorMap: Record<string, { status: number; message: string }> = {
  CHECKIN_ANSWER_REQUIRED: { status: 400, message: "답변을 입력해 주세요." },
  CHECKIN_ANSWER_TOO_LONG: { status: 400, message: "답변은 2,000자 이내로 입력해 주세요." },
  CHECKIN_INVALID_OPTION: { status: 400, message: "제공된 선택지 중 하나를 골라 주세요." },
  CHECKIN_UNEXPECTED_QUESTION: { status: 409, message: "질문 순서가 변경되었습니다. 다시 시도해 주세요." },
  CHECKIN_VERSION_CONFLICT: { status: 409, message: "다른 응답이 먼저 반영되었습니다. 화면을 새로고침해 주세요." },
  CHECKIN_ALREADY_COMPLETED: { status: 409, message: "이미 완료된 체크인입니다." },
  CHECKIN_FLOW_EXPIRED: { status: 410, message: "체크인 응답 시간이 만료되었습니다." },
  CHECKIN_SCOPE_MISMATCH: { status: 403, message: "이 체크인에 접근할 수 없습니다." },
  CHECKIN_SCHEDULE_NOT_FOUND: { status: 409, message: "데모 체크인 일정이 없습니다. 데모 시드를 먼저 적용해 주세요." },
  CHECKIN_TEMPLATE_NOT_FOUND: { status: 409, message: "데모 체크인 문항이 없습니다. 데모 시드를 먼저 적용해 주세요." },
};

export function demoApiError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const known = errorMap[code];
  if (known) return NextResponse.json({ ok: false, error: known.message }, { status: known.status });
  console.error("Demo API failed", error);
  return NextResponse.json({ ok: false, error: "데모를 실행하지 못했습니다. 서버 설정과 데이터베이스 연결을 확인해 주세요." }, { status: 500 });
}
