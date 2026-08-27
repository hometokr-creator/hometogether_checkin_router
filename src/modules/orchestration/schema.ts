import { z } from "zod";

export const conversationIntentSchema = z.enum([
  "SMALL_TALK",
  "LOOKUP_CONTRACT",
  "LOOKUP_PAYMENT",
  "LOOKUP_RULE",
  "LOOKUP_HOME",
  "RECORD_SCHEDULE",
  "REPORT_ISSUE",
  "FACILITY_REQUEST",
  "MOVE_OUT_CONSIDERATION",
  "EMOTIONAL_SIGNAL",
  "EMERGENCY",
  "UNKNOWN",
]);

export const conversationInterpretationSchema = z.object({
  intent: conversationIntentSchema,
  severity: z.enum(["S0", "S1", "S2", "S3"]),
  riskFlags: z.array(z.enum(["SAFETY", "HEALTH", "PRIVACY", "THREAT", "SELF_HARM", "NONE"])).min(1),
  entities: z.object({
    date: z.string().nullable(),
    time: z.string().nullable(),
    location: z.string().nullable(),
    facility: z.string().nullable(),
  }),
  confidence: z.number().min(0).max(1),
  reasonCodes: z.array(z.string().min(1)).min(1),
});

export type ConversationInterpretation = z.infer<typeof conversationInterpretationSchema>;

export const emptyConversationEntities: ConversationInterpretation["entities"] = {
  date: null,
  time: null,
  location: null,
  facility: null,
};
