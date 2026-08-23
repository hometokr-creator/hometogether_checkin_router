import { z } from "zod";

export const kakaoReachabilitySchema = z.enum(["NOT_LINKED", "LINKED_NOT_FRIEND", "FRIEND_ACTIVE", "BLOCKED", "DELIVERY_FAILED", "UNKNOWN"]);
export type KakaoReachability = z.infer<typeof kakaoReachabilitySchema>;

export const identityStatusSchema = z.enum(["LINKED", "UNLINKED", "CONFLICT"]);
export type IdentityStatus = z.infer<typeof identityStatusSchema>;

export const channelIdentityLinkSchema = z.object({
  id: z.string().min(1), provider: z.literal("KAKAO"), providerUserKey: z.string().min(1), memberId: z.string().min(1),
  householdId: z.string().min(1), contractCycleId: z.string().min(1), role: z.enum(["GUEST", "HOST"]),
  verifiedAt: z.iso.datetime(), revokedAt: z.iso.datetime().nullable().optional(), status: z.enum(["ACTIVE", "REVOKED", "CONFLICT"]),
});
export type ChannelIdentityLink = z.infer<typeof channelIdentityLinkSchema>;
