import type { KakaoReachability } from "./schema";

export type DeliveryChannel = "EVENT_API" | "ALIMTALK" | "OPERATOR_PHONE";
export interface DeliveryPlan { allowed: boolean; channel: DeliveryChannel; reasonCode: string }
export interface DeliveryContext {
  activeContract: boolean; linkedUserKey: boolean; reachability: KakaoReachability;
  eventApiFailed?: boolean; approvedInformationalTemplate?: boolean;
}

export function planCheckinDelivery(context: DeliveryContext): DeliveryPlan {
  if (!context.activeContract) return { allowed: false, channel: "OPERATOR_PHONE", reasonCode: "NO_ACTIVE_CONTRACT" };
  if (context.linkedUserKey && context.reachability === "FRIEND_ACTIVE" && !context.eventApiFailed) return { allowed: true, channel: "EVENT_API", reasonCode: "EVENT_API_ELIGIBLE" };
  if (context.approvedInformationalTemplate) return { allowed: true, channel: "ALIMTALK", reasonCode: context.eventApiFailed ? "EVENT_API_FAILED_FALLBACK" : "UNREACHABLE_EVENT_API_FALLBACK" };
  return { allowed: true, channel: "OPERATOR_PHONE", reasonCode: "PHONE_FALLBACK_REQUIRED" };
}
