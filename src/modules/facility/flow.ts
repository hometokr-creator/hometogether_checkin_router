import { z } from "zod";

export const facilityKindSchema = z.enum(["WIFI", "BOILER", "AIR_CONDITIONER", "DOOR_LOCK", "LEAK", "POWER", "OTHER"]);
export type FacilityKind = z.infer<typeof facilityKindSchema>;

export const facilityFlowStateSchema = z.object({
  status: z.enum(["WAITING_USER", "COMPLETED"]),
  step: z.enum(["SAFETY_CHECK", "RESOLUTION_CHECK", "COMPLETED"]),
  facility: facilityKindSchema,
  description: z.string().min(1).max(2000),
  initialMessageId: z.string().min(1),
  safetyConfirmed: z.boolean().nullable(),
  outcome: z.enum(["RESOLVED", "NEEDS_OPERATOR", "EMERGENCY"]).nullable(),
  version: z.number().int().positive(),
});

export type FacilityFlowState = z.infer<typeof facilityFlowStateSchema>;

export function detectFacilityKind(utterance: string): FacilityKind {
  const text = utterance.replace(/\s+/g, " ").trim().toLowerCase();
  if (text.includes("와이파이") || text.includes("wifi") || text.includes("인터넷")) return "WIFI";
  if (text.includes("보일러") || text.includes("난방") || text.includes("온수")) return "BOILER";
  if (text.includes("에어컨") || text.includes("냉방")) return "AIR_CONDITIONER";
  if (text.includes("도어록") || text.includes("현관문") || text.includes("문이 안 열")) return "DOOR_LOCK";
  if (text.includes("누수") || text.includes("물이 새") || text.includes("물 새")) return "LEAK";
  if (text.includes("전기") || text.includes("콘센트") || text.includes("정전")) return "POWER";
  return "OTHER";
}

export function startFacilityTriage(input: { description: string; initialMessageId: string }): FacilityFlowState {
  return facilityFlowStateSchema.parse({
    status: "WAITING_USER",
    step: "SAFETY_CHECK",
    facility: detectFacilityKind(input.description),
    description: input.description.trim(),
    initialMessageId: input.initialMessageId,
    safetyConfirmed: null,
    outcome: null,
    version: 1,
  });
}

function parseSafetyReply(value: string) {
  const text = value.replace(/\s+/g, "").trim().toUpperCase();
  if (["FACILITY_SAFETY:DANGER", "위험징후가있어요", "있어요", "네", "예"].includes(text)) return "DANGER" as const;
  if (["FACILITY_SAFETY:SAFE", "위험징후는없어요", "없어요", "아니요", "아니오"].includes(text)) return "SAFE" as const;
  return null;
}

function parseResolutionReply(value: string) {
  const text = value.replace(/\s+/g, "").trim().toUpperCase();
  if (["FACILITY_RESULT:RESOLVED", "해결됐어요", "해결됐습니다", "됐어요", "네"].includes(text)) return "RESOLVED" as const;
  if (["FACILITY_RESULT:UNRESOLVED", "아직안돼요", "해결안됐어요", "안돼요", "아니요", "아니오"].includes(text)) return "UNRESOLVED" as const;
  return null;
}

export function submitFacilityReply(input: { state: FacilityFlowState; expectedVersion: number; value: string }): FacilityFlowState {
  const state = facilityFlowStateSchema.parse(input.state);
  if (state.status !== "WAITING_USER") throw new Error("FACILITY_FLOW_COMPLETED");
  if (state.version !== input.expectedVersion) throw new Error("FACILITY_VERSION_CONFLICT");

  if (state.step === "SAFETY_CHECK") {
    const answer = parseSafetyReply(input.value);
    if (!answer) throw new Error("FACILITY_SAFETY_ANSWER_UNCLEAR");
    if (answer === "DANGER") {
      return { ...state, status: "COMPLETED", step: "COMPLETED", safetyConfirmed: false, outcome: "EMERGENCY", version: state.version + 1 };
    }
    return { ...state, step: "RESOLUTION_CHECK", safetyConfirmed: true, version: state.version + 1 };
  }

  const answer = parseResolutionReply(input.value);
  if (!answer) throw new Error("FACILITY_RESOLUTION_ANSWER_UNCLEAR");
  return {
    ...state,
    status: "COMPLETED",
    step: "COMPLETED",
    outcome: answer === "RESOLVED" ? "RESOLVED" : "NEEDS_OPERATOR",
    version: state.version + 1,
  };
}
