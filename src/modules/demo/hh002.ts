import type { ClassificationResult } from "../classification/schema";
export const hh002Classification: ClassificationResult = {
  intent: "COMPLAINT", domain: "NOISE", severity: "S2", urgency: "SAME_DAY", direction: "G_TO_H",
  interventionPreference: "COORDINATE", distressSignal: "EXPLICIT", riskFlags: [], confidence: 0.94,
  evidenceMessageIds: ["demo-message-hh002"], reasonCodes: ["DISTRESS_EXPLICIT", "SEVERITY_S2"],
};
export const hh002Evidence = [
  { label: "생활규칙", value: "소음 관련 확정 조항 없음", status: "NO_CLAUSE" },
  { label: "매칭 스냅샷", value: "호스트 야간 TV 빈도 있음", status: "SPEC_EVIDENCE" },
  { label: "게스트 성향", value: "야간 소음 민감 높음", status: "SPEC_EVIDENCE" },
] as const;
