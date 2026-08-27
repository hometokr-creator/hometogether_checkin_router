import type { KakaoSkillPayload } from "./skill";

const MAIN_MENU_UTTERANCES = new Set(["안녕", "안녕하세요", "시작", "처음", "처음으로", "메뉴", "메인메뉴"]);
const MAIN_MENU_BLOCK_NAMES = new Set(["시작", "처음으로", "메인메뉴", "웰컴"]);

function normalizeCommandText(value: string) {
  return value.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/[!.?\s]+/g, "").toLowerCase();
}

export function isKakaoMainMenuStart(payload: KakaoSkillPayload) {
  const command = payload.action?.params?.command;
  if (typeof command === "string" && command.toUpperCase() === "SHOW_MAIN_MENU") return true;

  const utterance = normalizeCommandText(payload.userRequest.utterance);
  const blockName = payload.userRequest.block?.name
    ? normalizeCommandText(payload.userRequest.block.name)
    : "";
  return MAIN_MENU_UTTERANCES.has(utterance) || MAIN_MENU_BLOCK_NAMES.has(blockName);
}

export function isKakaoCheckinStart(payload: KakaoSkillPayload) {
  const command = payload.action?.params?.command;
  if (typeof command === "string" && command.toUpperCase() === "START_CHECKIN") return true;
  const utterance = payload.userRequest.utterance.replace(/\s+/g, "").toLowerCase();
  const blockName = payload.userRequest.block?.name?.replace(/\s+/g, "").toLowerCase();
  return utterance === "정기체크인" || utterance === "정기체크인시작" || blockName === "정기체크인";
}
