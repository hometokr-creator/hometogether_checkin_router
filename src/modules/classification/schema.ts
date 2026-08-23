import { z } from "zod";
export const classificationSchema = z.object({
  intent: z.enum(["QUESTION", "REQUEST", "COMPLAINT", "REPORT", "CHANGE", "EMERGENCY", "FEEDBACK", "UNKNOWN"]),
  domain: z.enum(["FAQ", "CONTRACT", "SETTLEMENT", "NOISE", "CLEANING", "PRIVACY", "SPACE", "KITCHEN", "VISITOR", "RELATIONSHIP", "FACILITY", "SAFETY", "HEALTH", "RETENTION", "OTHER"]),
  severity: z.enum(["S1", "S2", "S3"]), urgency: z.enum(["NORMAL", "SAME_DAY", "IMMEDIATE"]),
  direction: z.enum(["G_TO_H", "H_TO_G", "MUTUAL", "NOT_APPLICABLE"]),
  interventionPreference: z.enum(["LISTEN_ONLY", "COORDINATE", "URGENT", "UNKNOWN"]),
  distressSignal: z.enum(["NONE", "POSSIBLE", "EXPLICIT"]),
  riskFlags: z.array(z.enum(["SAFETY", "HEALTH", "MONEY", "PRIVACY", "EXIT", "DIRECT_DEAL", "THREAT", "SELF_HARM", "LEGAL", "NONE"])),
  confidence: z.number().min(0).max(1), evidenceMessageIds: z.array(z.string().min(1)), reasonCodes: z.array(z.string().min(1)),
});
export type ClassificationResult = z.infer<typeof classificationSchema>;
export type AgreementStatus = "CLAUSE_EXISTS" | "NO_CLAUSE" | "CONFLICTING_CLAUSES" | "NOT_APPLICABLE" | "UNKNOWN";
