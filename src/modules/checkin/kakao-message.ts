import { z } from "zod";

export const signalSchema = z.enum(["GREEN", "YELLOW", "RED"]);
export type Signal = z.infer<typeof signalSchema>;
export interface CheckinQuestion { questionId: string; prompt: string }

export function createSignalQuestionMessage(question: CheckinQuestion) {
  return {
    version: "2.0",
    template: {
      outputs: [{ simpleText: { text: question.prompt } }],
      quickReplies: [
        { label: "🟢 괜찮아요", action: "message", messageText: `${question.questionId}:GREEN` },
        { label: "🟡 조금 불편해요", action: "message", messageText: `${question.questionId}:YELLOW` },
        { label: "🔴 많이 불편해요", action: "message", messageText: `${question.questionId}:RED` },
      ],
    },
  } as const;
}

export function parseSignalReply(value: string) {
  const [questionId, rawSignal, ...rest] = value.split(":");
  if (!questionId || rest.length > 0) return null;
  const signal = signalSchema.safeParse(rawSignal);
  return signal.success ? { questionId, signal: signal.data } : null;
}
