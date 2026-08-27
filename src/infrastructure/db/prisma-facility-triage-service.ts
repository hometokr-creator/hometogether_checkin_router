import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { facilityFlowStateSchema, startFacilityTriage, submitFacilityReply } from "@/modules/facility/flow";
import { presentFacilityTriage, type FacilityTriagePresentation } from "@/modules/facility/presentation";
import { decideFacilityRecurrence } from "@/modules/facility/recurrence-policy";

type FacilityScope = {
  householdId: string;
  contractCycleId: string;
  memberId: string;
  channelIdentityLinkId: string;
};

function unclearPresentation(step: "SAFETY_CHECK" | "RESOLUTION_CHECK"): FacilityTriagePresentation {
  return step === "SAFETY_CHECK"
    ? {
        text: "안전 확인을 위해 아래 두 선택지 중 하나로 답해 주세요.",
        choices: [
          { label: "위험 징후는 없어요", value: "FACILITY_SAFETY:SAFE" },
          { label: "위험 징후가 있어요", value: "FACILITY_SAFETY:DANGER" },
        ],
        status: "WAITING_USER",
        outcome: null,
      }
    : {
        text: "안내 후 문제가 해결됐는지 아래에서 선택해 주세요.",
        choices: [
          { label: "해결됐어요", value: "FACILITY_RESULT:RESOLVED" },
          { label: "아직 안 돼요", value: "FACILITY_RESULT:UNRESOLVED" },
        ],
        status: "WAITING_USER",
        outcome: null,
      };
}

export class PrismaFacilityTriageService {
  constructor(private readonly prisma: PrismaClient) {}

  async start(input: FacilityScope & { utterance: string; now?: Date }) {
    const now = input.now ?? new Date();
    return this.prisma.$transaction(async (tx) => {
      const scopedLink = await tx.channelIdentityLink.findFirst({
        where: {
          id: input.channelIdentityLinkId,
          householdId: input.householdId,
          contractCycleId: input.contractCycleId,
          memberId: input.memberId,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!scopedLink) throw new Error("FACILITY_SCOPE_MISMATCH");

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
      const active = await tx.flowInstance.findFirst({
        where: {
          contractCycleId: input.contractCycleId,
          memberId: input.memberId,
          status: { in: ["IN_PROGRESS", "WAITING_USER"] },
          expiresAt: { gt: now },
        },
        orderBy: { updatedAt: "desc" },
      });
      if (active) {
        if (active.type !== "FACILITY_TRIAGE") throw new Error("ACTIVE_FLOW_CONFLICT");
        const state = facilityFlowStateSchema.parse(active.context);
        return { flowId: active.id, presentation: presentFacilityTriage(state), issueId: null };
      }

      const message = await tx.conversationMessage.create({
        data: { conversationId: conversation.id, direction: "INBOUND", kind: "TEXT", body: input.utterance, accessLevel: "A" },
      });
      const state = startFacilityTriage({ description: input.utterance, initialMessageId: message.id });
      const flow = await tx.flowInstance.create({
        data: {
          householdId: input.householdId,
          contractCycleId: input.contractCycleId,
          memberId: input.memberId,
          conversationId: conversation.id,
          type: "FACILITY_TRIAGE",
          status: "WAITING_USER",
          stepKey: state.step,
          context: state as unknown as Prisma.InputJsonValue,
          version: state.version,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
      });
      const event = await tx.householdEvent.create({
        data: {
          householdId: input.householdId,
          contractCycleId: input.contractCycleId,
          memberId: input.memberId,
          source: "INBOUND",
          eventType: "FACILITY_TRIAGE_STARTED",
          occurredAt: now,
          payload: { flowId: flow.id, messageId: message.id, facility: state.facility },
        },
      });
      await tx.auditLog.create({
        data: {
          event: "FACILITY_TRIAGE_STARTED",
          householdId: input.householdId,
          entityType: "FlowInstance",
          entityId: flow.id,
          payload: { eventId: event.id, messageId: message.id, facility: state.facility },
        },
      });
      return { flowId: flow.id, presentation: presentFacilityTriage(state), issueId: null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async consumeActiveReply(input: FacilityScope & { utterance: string; now?: Date }) {
    const now = input.now ?? new Date();
    return this.prisma.$transaction(async (tx) => {
      const flow = await tx.flowInstance.findFirst({
        where: {
          householdId: input.householdId,
          contractCycleId: input.contractCycleId,
          memberId: input.memberId,
          type: "FACILITY_TRIAGE",
          status: { in: ["IN_PROGRESS", "WAITING_USER"] },
        },
        orderBy: { updatedAt: "desc" },
      });
      if (!flow) return null;
      if (flow.expiresAt <= now) {
        await tx.flowInstance.update({ where: { id: flow.id }, data: { status: "EXPIRED", stepKey: "expired" } });
        return null;
      }
      if (!flow.conversationId) throw new Error("FACILITY_CONVERSATION_REQUIRED");
      await tx.conversation.update({ where: { id: flow.conversationId }, data: { lastMessageAt: now } });

      const state = facilityFlowStateSchema.parse(flow.context);
      let nextState;
      try {
        nextState = submitFacilityReply({ state, expectedVersion: flow.version, value: input.utterance });
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        if (code !== "FACILITY_SAFETY_ANSWER_UNCLEAR" && code !== "FACILITY_RESOLUTION_ANSWER_UNCLEAR") throw error;
        await tx.conversationMessage.create({
          data: { conversationId: flow.conversationId, direction: "INBOUND", kind: "TEXT", body: input.utterance, accessLevel: "A" },
        });
        return { flowId: flow.id, presentation: unclearPresentation(state.step === "SAFETY_CHECK" ? "SAFETY_CHECK" : "RESOLUTION_CHECK"), issueId: null };
      }

      const message = await tx.conversationMessage.create({
        data: {
          conversationId: flow.conversationId,
          direction: "INBOUND",
          kind: "TEXT",
          body: input.utterance,
          accessLevel: nextState.outcome === "EMERGENCY" ? "C" : "A",
        },
      });
      const updated = await tx.flowInstance.updateMany({
        where: { id: flow.id, version: flow.version, status: "WAITING_USER" },
        data: {
          status: nextState.status,
          stepKey: nextState.step,
          context: nextState as unknown as Prisma.InputJsonValue,
          version: nextState.version,
        },
      });
      if (updated.count !== 1) throw new Error("FACILITY_VERSION_CONFLICT");

      let issueId: string | null = null;
      let recurrenceEscalated = false;
      let occurrenceNumber: number | null = null;
      if (nextState.outcome === "NEEDS_OPERATOR" || nextState.outcome === "EMERGENCY") {
        const emergency = nextState.outcome === "EMERGENCY";
        const priorIssues = emergency ? [] : await tx.issue.findMany({
          where: {
            householdId: input.householdId,
            contractCycleId: input.contractCycleId,
            memberId: input.memberId,
            domain: "FACILITY",
            openedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { openedAt: "desc" },
          take: 20,
          select: { id: true, severity: true, classification: true },
        });
        const recurrence = decideFacilityRecurrence(state.facility, priorIssues);
        recurrenceEscalated = !emergency && recurrence.severity === "S2";
        occurrenceNumber = emergency ? null : recurrence.occurrenceNumber;
        const issue = await tx.issue.create({
          data: {
            householdId: input.householdId,
            contractCycleId: input.contractCycleId,
            memberId: input.memberId,
            reporterMessageId: state.initialMessageId,
            route: "B",
            intent: emergency ? "EMERGENCY" : "REQUEST",
            domain: emergency ? "SAFETY" : "FACILITY",
            severity: emergency ? "S3" : recurrence.severity,
            urgency: emergency ? "IMMEDIATE" : recurrence.urgency,
            classification: {
              source: "FACILITY_TRIAGE",
              facility: state.facility,
              outcome: nextState.outcome,
              ...(emergency ? {} : {
                recurrenceKey: recurrence.recurrenceKey,
                occurrenceNumber: recurrence.occurrenceNumber,
                priorIssueIds: recurrence.priorIssueIds,
                recurrenceWindowDays: 30,
              }),
              reasonCodes: emergency ? ["FACILITY_CONTEXTUAL_DANGER"] : recurrence.reasonCodes,
            },
            openedAt: now,
          },
        });
        issueId = issue.id;
        await tx.actionTicket.create({
          data: {
            issueId: issue.id,
            queue: "OPERATOR_REVIEW",
            dueAt: new Date(now.getTime() + (emergency ? 1 : recurrence.dueHours) * 60 * 60 * 1000),
          },
        });
      }

      const event = await tx.householdEvent.create({
        data: {
          householdId: input.householdId,
          contractCycleId: input.contractCycleId,
          memberId: input.memberId,
          issueId,
          source: "INBOUND",
          eventType: nextState.outcome === "RESOLVED"
            ? "FACILITY_RESOLVED_SELF_HELP"
            : nextState.outcome === "NEEDS_OPERATOR"
              ? recurrenceEscalated ? "FACILITY_RECURRENCE_ESCALATED" : "FACILITY_ESCALATED"
              : nextState.outcome === "EMERGENCY"
                ? "FACILITY_EMERGENCY_REPORTED"
                : "FACILITY_TRIAGE_STEP_COMPLETED",
          occurredAt: now,
          payload: { flowId: flow.id, replyMessageId: message.id, step: nextState.step, facility: state.facility, occurrenceNumber, redacted: nextState.outcome === "EMERGENCY" },
        },
      });
      await tx.auditLog.create({
        data: {
          event: "FACILITY_TRIAGE_UPDATED",
          householdId: input.householdId,
          entityType: "FlowInstance",
          entityId: flow.id,
          payload: { eventId: event.id, issueId, step: nextState.step, outcome: nextState.outcome, occurrenceNumber },
        },
      });
      const presentation = presentFacilityTriage(nextState);
      return {
        flowId: flow.id,
        presentation: recurrenceEscalated
          ? { ...presentation, text: "같은 시설 문제가 최근에도 접수되어 우선순위를 높였어요. 운영팀이 당일 검토할 수 있도록 S2 이슈로 기록했습니다." }
          : presentation,
        issueId,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async cancelActiveForEmergency(input: Omit<FacilityScope, "channelIdentityLinkId">) {
    return this.prisma.flowInstance.updateMany({
      where: {
        householdId: input.householdId,
        contractCycleId: input.contractCycleId,
        memberId: input.memberId,
        type: "FACILITY_TRIAGE",
        status: { in: ["IN_PROGRESS", "WAITING_USER"] },
      },
      data: { status: "CANCELLED", stepKey: "interrupted_by_emergency" },
    });
  }
}
