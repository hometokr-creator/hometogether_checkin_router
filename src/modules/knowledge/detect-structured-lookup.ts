import type { StructuredLookupRequest } from "./structured-lookup";

const includesAny = (text: string, terms: readonly string[]) => terms.some((term) => text.includes(term));

export function detectStructuredLookup(utterance: string): StructuredLookupRequest | null {
  const text = utterance.replace(/\s+/g, " ").trim().toLowerCase();

  if (includesAny(text, ["다음 납부", "납부 예정", "언제 내", "납부일"])) return { type: "NEXT_PAYMENT" };
  if (text.includes("계약") && includesAny(text, ["언제까지", "종료", "끝", "기간"])) return { type: "CONTRACT_END" };
  if (includesAny(text, ["월세", "관리비", "공과금", "매월 얼마", "한 달 얼마"])) return { type: "MONTHLY_PAYMENT" };
  if (includesAny(text, ["세탁", "빨래"])) return { type: "KNOWLEDGE", category: "laundry", key: "allowed_window" };
  if (includesAny(text, ["조용한 시간", "정숙", "몇 시부터 조용"])) return { type: "KNOWLEDGE", category: "quiet_hours", key: "daily_window" };
  if (includesAny(text, ["주방에서 어디", "수납", "냉장고 어디"])) return { type: "KNOWLEDGE", category: "storage", key: "kitchen" };
  if (includesAny(text, ["주방", "요리", "라면", "취사"])) return { type: "KNOWLEDGE", category: "kitchen", key: "general_window" };
  if (includesAny(text, ["방문객", "친구 데려", "친구가 와", "손님"])) return { type: "KNOWLEDGE", category: "visitor", key: "default_policy" };
  if (includesAny(text, ["내 방", "방 크기", "방 면적"])) return { type: "KNOWLEDGE", category: "room", key: "guest_room" };
  return null;
}
