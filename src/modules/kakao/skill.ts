import { z } from "zod";

export const kakaoSkillPayloadSchema = z.object({
  userRequest: z.object({
    utterance: z.string().min(1),
    user: z.object({
      id: z.string().min(1),
      type: z.string().nullish(),
      properties: z.record(z.string(), z.unknown()).nullish(),
    }).passthrough(),
    block: z.object({ id: z.string().min(1), name: z.string().nullish() }).passthrough().nullish(),
    callbackUrl: z.url().nullish(),
  }),
  bot: z.object({ id: z.string().min(1), name: z.string().nullish() }).passthrough().nullish(),
  action: z.object({ id: z.string().nullish(), name: z.string().nullish() }).passthrough().nullish(),
}).passthrough();

export type KakaoSkillPayload = z.infer<typeof kakaoSkillPayloadSchema>;

export function kakaoSimpleText(text: string) {
  return {
    version: "2.0" as const,
    template: { outputs: [{ simpleText: { text } }] },
  };
}

export function getKakaoProviderUserKey(payload: KakaoSkillPayload) {
  const channelUserKey = payload.userRequest.user.properties?.plusfriendUserKey;
  return typeof channelUserKey === "string" && channelUserKey.length > 0
    ? channelUserKey
    : payload.userRequest.user.id;
}

const LINKING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const EMBEDDED_LINKING_TOKEN_PATTERN = /(?:^|[^A-Za-z0-9_-])([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/;

export function extractLinkingToken(utterance: string) {
  const normalized = utterance.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").trim();
  if (LINKING_TOKEN_PATTERN.test(normalized)) return normalized;

  const prefixed = normalized.match(/^(?:연결\s*코드|연결\s*토큰)\s*[:：]?\s*(\S+)$/i)?.[1];
  if (prefixed && LINKING_TOKEN_PATTERN.test(prefixed)) return prefixed;

  return normalized.match(EMBEDDED_LINKING_TOKEN_PATTERN)?.[1] ?? null;
}
