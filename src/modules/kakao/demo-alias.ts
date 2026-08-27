export const KAKAO_DEMO_ALIAS = "HOMETO";

export function canUseKakaoDemoAlias(input: { utterance: string; botId?: string | null; enabled?: string; allowedBotIds?: string }) {
  if (input.enabled !== "true") return false;
  if (input.utterance.replace(/\s+/g, "").toUpperCase() !== KAKAO_DEMO_ALIAS) return false;
  if (!input.botId) return false;
  const allowed = new Set((input.allowedBotIds ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  return allowed.has(input.botId);
}
