import type { FacilityFlowState, FacilityKind } from "./flow";

export type FacilityTriagePresentation = {
  text: string;
  choices: Array<{ label: string; value: string }>;
  status: FacilityFlowState["status"];
  outcome: FacilityFlowState["outcome"];
};

const guidance: Record<FacilityKind, string> = {
  WIFI: "공유기의 전원과 케이블이 빠지지 않았는지 확인하고, 전원을 10초 정도 껐다가 다시 켜 주세요. 초기화 버튼은 누르지 마세요.",
  BOILER: "보일러 화면의 오류 코드를 확인하고 실내조절기의 난방·온수 모드를 다시 선택해 주세요. 본체를 열거나 가스 밸브를 조작하지 마세요.",
  AIR_CONDITIONER: "리모컨이 냉방 모드인지, 희망 온도가 현재 온도보다 낮은지, 필터 흡입구가 막히지 않았는지 확인해 주세요. 본체 분해는 하지 마세요.",
  DOOR_LOCK: "문이 열린 안전한 상태라면 배터리 부족 표시를 확인해 주세요. 잠금장치를 분해하거나 강제로 열지 마세요.",
  LEAK: "물이 전기제품이나 콘센트에 닿지 않게 거리를 두고, 가능하면 그릇이나 수건으로 번짐만 줄여 주세요. 배관이나 전기설비는 직접 분해하지 마세요.",
  POWER: "타는 냄새나 불꽃이 없다면 다른 방도 정전인지 확인해 주세요. 분전반·콘센트·배선을 직접 분해하거나 만지지 마세요.",
  OTHER: "기기의 전원 표시와 눈에 보이는 연결 상태만 확인해 주세요. 커버를 열거나 부품을 분해하지 마세요.",
};

export function presentFacilityTriage(state: FacilityFlowState): FacilityTriagePresentation {
  if (state.status === "COMPLETED") {
    if (state.outcome === "RESOLVED") return { text: "해결된 것으로 기록했어요. 같은 문제가 다시 생기면 언제든 말씀해 주세요.", choices: [], status: state.status, outcome: state.outcome };
    if (state.outcome === "EMERGENCY") return { text: "자가조치를 중단하고 위험한 곳에서 벗어나 주세요. 즉시 위험하다면 112 또는 119에 직접 연락해 주세요. 운영팀 긴급 확인 대상으로 접수했습니다.", choices: [], status: state.status, outcome: state.outcome };
    return { text: "아직 해결되지 않은 것으로 접수했어요. 운영팀이 확인할 수 있도록 시설 이슈를 만들었습니다.", choices: [], status: state.status, outcome: state.outcome };
  }
  if (state.step === "SAFETY_CHECK") {
    return {
      text: "먼저 안전을 확인할게요. 연기·불꽃·가스 냄새·감전 위험이 있거나, 물이 전기설비 근처로 새고 있나요?",
      choices: [
        { label: "위험 징후는 없어요", value: "FACILITY_SAFETY:SAFE" },
        { label: "위험 징후가 있어요", value: "FACILITY_SAFETY:DANGER" },
      ],
      status: state.status,
      outcome: state.outcome,
    };
  }
  return {
    text: `${guidance[state.facility]}\n\n확인한 뒤 문제가 해결됐는지 알려주세요.`,
    choices: [
      { label: "해결됐어요", value: "FACILITY_RESULT:RESOLVED" },
      { label: "아직 안 돼요", value: "FACILITY_RESULT:UNRESOLVED" },
    ],
    status: state.status,
    outcome: state.outcome,
  };
}
