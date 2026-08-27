import type { PrismaClient } from "@/generated/prisma/client";
import type { ClassificationResult } from "@/modules/classification/schema";
import type { RoutingDecision } from "@/modules/routing/decide-route";
import { calculateTicketDueAt } from "@/modules/classification/classify-inbound";
import { shouldOpenIssue } from "@/modules/conversations/issue-policy";
import type { ConversationInterpretation } from "@/modules/orchestration/schema";

export class PrismaInboundRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async record(input: {
    householdId: string;
    contractCycleId: string;
    memberId: string;
    channelIdentityLinkId: string;
    utterance: string;
    classification: ClassificationResult;
    decision: RoutingDecision;
    sourceClauseIds?: string[];
    classificationSource?: "OPENAI" | "RULES" | "RULES_FALLBACK";
    openIssue?: boolean;
    messageAccessLevel?: "A" | "B" | "C";
    noIssueEventType?: "LOOKUP_SERVED" | "SMALL_TALK_ANSWERED" | "CLARIFICATION_REQUESTED" | "SCHEDULE_RECORD_REQUESTED";
    modelRun?: {
      task: string; provider: string; model?: string; status: "SUCCEEDED" | "FAILED" | "FALLBACK";
      promptTemplateKey: string; promptTemplateVersion: number; providerPromptId?: string;
      providerPromptVersion?: string; providerResponseId?: string; inputHash: string;
      output?: ClassificationResult | ConversationInterpretation; errorCode?: string; latencyMs?: number; inputTokens?: number; outputTokens?: number;
    } | null;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.upsert({
        where: { channelIdentityLinkId: input.channelIdentityLinkId },
        update: { status: "ACTIVE", lastMessageAt: now },
        create: {
          householdId: input.householdId,
          contractCycleId: input.contractCycleId,
          memberId: input.memberId,
          channelIdentityLinkId: input.channelIdentityLinkId,
          channel: "KAKAO",
          lastMessageAt: now,
        },
      });
      const message = await tx.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          direction: "INBOUND",
          kind: "TEXT",
          body: input.utterance,
          accessLevel: input.messageAccessLevel ?? "A",
        },
      });

      if (!(input.openIssue ?? shouldOpenIssue(input.decision))) {
        const event = await tx.householdEvent.create({
          data: {
            householdId: input.householdId,
            contractCycleId: input.contractCycleId,
            memberId: input.memberId,
            source: "INBOUND",
            eventType: input.noIssueEventType ?? "LOOKUP_SERVED",
            occurredAt: now,
            payload: { messageId: message.id, sourceClauseIds: input.sourceClauseIds ?? [] },
          },
        });
        if (input.modelRun) await tx.modelRun.create({ data: input.modelRun });
        await tx.auditLog.create({
          data: {
            event: "INBOUND_ANSWERED",
            householdId: input.householdId,
            entityType: "ConversationMessage",
            entityId: message.id,
            payload: {
              eventId: event.id,
              route: input.decision.route,
              reasonCodes: input.decision.reasonCodes,
              sourceClauseIds: input.sourceClauseIds ?? [],
              classificationSource: input.classificationSource ?? "RULES",
            },
          },
        });
        return { conversationId: conversation.id, messageId: message.id, issueId: null, eventId: event.id, ticketId: null };
      }

      const issue = await tx.issue.create({
        data: {
          householdId: input.householdId,
          contractCycleId: input.contractCycleId,
          memberId: input.memberId,
          reporterMessageId: message.id,
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
          payload: input.messageAccessLevel === "C"
            ? { messageId: message.id, redacted: true, sourceClauseIds: input.sourceClauseIds ?? [] }
            : { messageId: message.id, utterance: input.utterance, sourceClauseIds: input.sourceClauseIds ?? [] },
        },
      });
      const ticket = input.decision.route === "A" ? null : await tx.actionTicket.create({
        data: {
          issueId: issue.id,
          queue: input.decision.route === "C" ? "PARTNER_REVIEW" : "OPERATOR_REVIEW",
          dueAt: calculateTicketDueAt(input.classification.urgency, now),
        },
      });
      if (input.modelRun) {
        await tx.modelRun.create({
          data: { ...input.modelRun, issueId: issue.id },
        });
      }
      await tx.auditLog.create({
        data: {
          event: "INBOUND_ROUTED",
          householdId: input.householdId,
          entityType: "Issue",
          entityId: issue.id,
          payload: { eventId: event.id, ticketId: ticket?.id ?? null, route: input.decision.route, reasonCodes: input.decision.reasonCodes, sourceClauseIds: input.sourceClauseIds ?? [], classificationSource: input.classificationSource ?? "RULES" },
        },
      });
      return { conversationId: conversation.id, messageId: message.id, issueId: issue.id, eventId: event.id, ticketId: ticket?.id ?? null };
    });
  }
}
