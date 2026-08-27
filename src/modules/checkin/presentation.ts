import type { CheckinDisposition, CheckinFlowState } from "./flow";
import { checkinTemplateSchema, type CheckinTemplate } from "./template-schema";

export type CheckinPresentation = {
  status: CheckinFlowState["status"];
  version: number;
  step: number;
  totalSteps: number;
  disposition: CheckinDisposition;
  question: null | {
    key: string;
    type: "SINGLE_CHOICE" | "FREE_TEXT";
    prompt: string;
    options?: Array<{ value: string; label: string }>;
  };
};

export function presentCheckin(templateInput: CheckinTemplate, state: CheckinFlowState): CheckinPresentation {
  const template = checkinTemplateSchema.parse(templateInput);
  if (template.id !== state.templateId) throw new Error("CHECKIN_TEMPLATE_MISMATCH");

  if (state.status === "COMPLETED") {
    return {
      status: state.status,
      version: state.version,
      step: template.questions.length,
      totalSteps: template.questions.length,
      disposition: state.disposition,
      question: null,
    };
  }

  const questionIndex = template.questions.findIndex((question) => question.key === state.currentQuestionKey);
  const question = template.questions[questionIndex];
  if (!question) throw new Error("CHECKIN_QUESTION_NOT_FOUND");

  return {
    status: state.status,
    version: state.version,
    step: questionIndex + 1,
    totalSteps: template.questions.length,
    disposition: state.disposition,
    question: question.type === "SINGLE_CHOICE"
      ? {
          key: question.key,
          type: question.type,
          prompt: question.prompt,
          options: question.options.map(({ value, label }) => ({ value, label })),
        }
      : { key: question.key, type: question.type, prompt: question.prompt },
  };
}
