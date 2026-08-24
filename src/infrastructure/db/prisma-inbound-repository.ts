import type { PrismaClient } from "@/generated/prisma/client";
import type { ClassificationResult } from "@/modules/classification/schema";
import type { RoutingDecision } from "@/modules/routing/decide-route";
import { calculateTicketDueAt } from "@/modules/classification/classify-inbound";

export class PrismaInboundRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async record(input: {
    householdId: string;
    contractCycleId: string;
    memberId: string;
    utterance: string;
    classification: ClassificationResult;
    decision: RoutingDecision;
    sourceClauseIds?: string[];
    classificationSource?: "OPENAI" | "RULES" | "RULES_FALLBACK";
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.issue.create({
        data: {
          householdId: input.householdId,
          contractCycleId: input.contractCycleId,
          memberId: input.memberId,
          route: input.decision.route,
          intent: input.classification.intent,
          domain: input.classification.domain,
          severity: input.classification.severity,
          urgency: input.classification.urgency,
          classification: input.classification,
          openedAt: now,
        },
      });
      const event = await tx.householdEvent.create({
        data: {
          householdId: input.householdId,
          contractCycleId: input.contractCycleId,
          memberId: input.memberId,
          issueId: issue.id,
          source: "INBOUND",
          eventType: "KAKAO_MESSAGE_RECEIVED",
          occurredAt: now,
          payload: { utterance: input.utterance, sourceClauseIds: input.sourceClauseIds ?? [] },
        },
      });
      const ticket = input.decision.route === "A" ? null : await tx.actionTicket.create({
        data: {
          issueId: issue.id,
          queue: input.decision.route === "C" ? "PARTNER_REVIEW" : "OPERATOR_REVIEW",
          dueAt: calculateTicketDueAt(input.classification.urgency, now),
        },
      });
      await tx.auditLog.create({
        data: {
          event: "INBOUND_ROUTED",
          householdId: input.householdId,
          entityType: "Issue",
          entityId: issue.id,
          payload: { eventId: event.id, ticketId: ticket?.id ?? null, route: input.decision.route, reasonCodes: input.decision.reasonCodes, sourceClauseIds: input.sourceClauseIds ?? [], classificationSource: input.classificationSource ?? "RULES" },
        },
      });
      return { issueId: issue.id, eventId: event.id, ticketId: ticket?.id ?? null };
    });
  }
}
