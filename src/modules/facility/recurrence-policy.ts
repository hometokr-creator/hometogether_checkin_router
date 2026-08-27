import { z } from "zod";
import { facilityKindSchema, type FacilityKind } from "./flow";

const storedClassificationSchema = z.object({
  source: z.literal("FACILITY_TRIAGE"),
  facility: facilityKindSchema,
}).passthrough();

export type PriorFacilityIssue = {
  id: string;
  severity: string;
  classification: unknown;
};

export type FacilityRecurrenceDecision = {
  recurrenceKey: string;
  occurrenceNumber: number;
  priorIssueIds: string[];
  severity: "S1" | "S2";
  urgency: "NORMAL" | "SAME_DAY";
  dueHours: 24 | 8;
  reasonCodes: string[];
};

export function decideFacilityRecurrence(facility: FacilityKind, priorIssues: PriorFacilityIssue[]): FacilityRecurrenceDecision {
  const matching = priorIssues.filter((issue) => {
    const parsed = storedClassificationSchema.safeParse(issue.classification);
    return parsed.success && parsed.data.facility === facility;
  });
  const recurring = matching.length > 0;
  return {
    recurrenceKey: `FACILITY:${facility}`,
    occurrenceNumber: matching.length + 1,
    priorIssueIds: matching.slice(0, 5).map((issue) => issue.id),
    severity: recurring ? "S2" : "S1",
    urgency: recurring ? "SAME_DAY" : "NORMAL",
    dueHours: recurring ? 8 : 24,
    reasonCodes: recurring ? ["SELF_HELP_UNRESOLVED", "RECURRING_FACILITY_ISSUE"] : ["SELF_HELP_UNRESOLVED"],
  };
}
