import { z } from "zod";

export const kakaoSkillPayloadSchema = z.object({
  userRequest: z.object({
    utterance: z.string().min(1),
    user: z.object({
      id: z.string().min(1),
      type: z.string().optional(),
      properties: z.record(z.string(), z.string()).optional(),
    }),
    block: z.object({ id: z.string().min(1), name: z.string().optional() }).optional(),
    callbackUrl: z.url().optional(),
  }),
  bot: z.object({ id: z.string().min(1), name: z.string().optional() }).optional(),
  action: z.object({ id: z.string().optional(), name: z.string().optional() }).passthrough().optional(),
}).passthrough();

export type KakaoSkillPayload = z.infer<typeof kakaoSkillPayloadSchema>;

export function kakaoSimpleText(text: string) {
  return {
    version: "2.0" as const,
    template: { outputs: [{ simpleText: { text } }] },
  };
}

export function getKakaoProviderUserKey(payload: KakaoSkillPayload) {
  return payload.userRequest.user.properties?.plusfriendUserKey
    ?? payload.userRequest.user.id;
}
