import { checkinTemplateSchema, type CheckinSignal, type CheckinTemplate } from "./template-schema";
import { z } from "zod";

export type CheckinDisposition = "OK" | "NEEDS_CLASSIFICATION" | "NEEDS_REVIEW" | "EMERGENCY";

export type CheckinFlowState = {
  templateId: string;
  status: "WAITING_USER" | "COMPLETED";
  currentQuestionKey: string | null;
  answers: Record<string, string>;
  disposition: CheckinDisposition;
  version: number;
};

export const checkinFlowStateSchema = z.object({
  templateId: z.string().min(1),
  status: z.enum(["WAITING_USER", "COMPLETED"]),
  currentQuestionKey: z.string().min(1).nullable(),
  answers: z.record(z.string(), z.string()),
  disposition: z.enum(["OK", "NEEDS_CLASSIFICATION", "NEEDS_REVIEW", "EMERGENCY"]),
  version: z.number().int().positive(),
});

const dispositionRank: Record<CheckinDisposition, number> = {
  OK: 0,
  NEEDS_CLASSIFICATION: 1,
  NEEDS_REVIEW: 2,
  EMERGENCY: 3,
};

function mergeDisposition(current: CheckinDisposition, next: CheckinDisposition) {
  return dispositionRank[next] > dispositionRank[current] ? next : current;
}

function signalDisposition(signal: CheckinSignal): CheckinDisposition {
  if (signal === "EMERGENCY") return "EMERGENCY";
  if (signal === "REVIEW") return "NEEDS_REVIEW";
  if (signal === "CLASSIFY") return "NEEDS_CLASSIFICATION";
  return "OK";
}

function freeTextDisposition(value: string): CheckinDisposition {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  return ["없어요", "없음", "특별히없어요", "괜찮아요"].includes(normalized) ? "OK" : "NEEDS_CLASSIFICATION";
}

export function startCheckin(rawTemplate: CheckinTemplate): CheckinFlowState {
  const template = checkinTemplateSchema.parse(rawTemplate);
  return {
    templateId: template.id,
    status: "WAITING_USER",
    currentQuestionKey: template.questions[0].key,
    answers: {},
    disposition: "OK",
    version: 1,
  };
}

export function submitCheckinAnswer(input: {
  template: CheckinTemplate;
  state: CheckinFlowState;
  expectedVersion: number;
  questionKey: string;
  value: string;
}): CheckinFlowState {
  const template = checkinTemplateSchema.parse(input.template);
  if (input.state.templateId !== template.id) throw new Error("CHECKIN_TEMPLATE_MISMATCH");
  if (input.state.status !== "WAITING_USER") throw new Error("CHECKIN_ALREADY_COMPLETED");
  if (input.expectedVersion !== input.state.version) throw new Error("CHECKIN_VERSION_CONFLICT");
  if (input.questionKey !== input.state.currentQuestionKey) throw new Error("CHECKIN_UNEXPECTED_QUESTION");

  const questionIndex = template.questions.findIndex((question) => question.key === input.questionKey);
  const question = template.questions[questionIndex];
  if (!question) throw new Error("CHECKIN_QUESTION_NOT_FOUND");

  const value = input.value.trim();
  if (!value) throw new Error("CHECKIN_ANSWER_REQUIRED");

  let answerDisposition: CheckinDisposition;
  if (question.type === "SINGLE_CHOICE") {
    const option = question.options.find((candidate) => candidate.value === value);
    if (!option) throw new Error("CHECKIN_INVALID_OPTION");
    answerDisposition = signalDisposition(option.signal);
  } else {
    if (value.length > 2000) throw new Error("CHECKIN_ANSWER_TOO_LONG");
    answerDisposition = freeTextDisposition(value);
  }

  const nextQuestion = template.questions[questionIndex + 1] ?? null;
  return {
    ...input.state,
    status: nextQuestion ? "WAITING_USER" : "COMPLETED",
    currentQuestionKey: nextQuestion?.key ?? null,
    answers: { ...input.state.answers, [question.key]: value },
    disposition: mergeDisposition(input.state.disposition, answerDisposition),
    version: input.state.version + 1,
  };
}
