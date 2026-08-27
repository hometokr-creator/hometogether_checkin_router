import { z } from "zod";

const signalSchema = z.enum(["NONE", "CLASSIFY", "REVIEW", "EMERGENCY"]);

const choiceQuestionSchema = z.object({
  key: z.string().min(1),
  type: z.literal("SINGLE_CHOICE"),
  prompt: z.string().min(1),
  options: z.array(z.object({
    value: z.string().min(1),
    label: z.string().min(1),
    signal: signalSchema,
  })).min(2),
});

const freeTextQuestionSchema = z.object({
  key: z.string().min(1),
  type: z.literal("FREE_TEXT"),
  prompt: z.string().min(1),
});

export const checkinTemplateSchema = z.object({
  id: z.string().min(1),
  questions: z.array(z.discriminatedUnion("type", [choiceQuestionSchema, freeTextQuestionSchema])).min(1),
}).superRefine((template, context) => {
  const keys = template.questions.map((question) => question.key);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", message: "Question keys must be unique", path: ["questions"] });
});

export type CheckinTemplate = z.infer<typeof checkinTemplateSchema>;
export type CheckinQuestion = CheckinTemplate["questions"][number];
export type CheckinSignal = z.infer<typeof signalSchema>;
