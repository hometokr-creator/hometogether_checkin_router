import type { KakaoSkillPayload } from "./skill";

export function isKakaoCheckinStart(payload: KakaoSkillPayload) {
  const command = payload.action?.params?.command;
  if (typeof command === "string" && command.toUpperCase() === "START_CHECKIN") return true;
  const utterance = payload.userRequest.utterance.replace(/\s+/g, "").toLowerCase();
  const blockName = payload.userRequest.block?.name?.replace(/\s+/g, "").toLowerCase();
  return utterance === "정기체크인" || utterance === "정기체크인시작" || blockName === "정기체크인";
}
