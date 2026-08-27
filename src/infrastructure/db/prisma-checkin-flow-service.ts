import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { checkinFlowStateSchema, startCheckin, submitCheckinAnswer } from "@/modules/checkin/flow";
import { checkinTemplateSchema } from "@/modules/checkin/template-schema";

export class PrismaCheckinFlowService {
  constructor(private readonly prisma: PrismaClient) {}

  async start(input: { scheduleId: string; memberId: string; contractCycleId: string; conversationId?: string; now?: Date }) {
    const now = input.now ?? new Date();
    return this.prisma.$transaction(async (tx) => {
      const schedule = await tx.checkinSchedule.findUnique({
        where: { id: input.scheduleId },
        include: { template: { select: { id: true, questions: true, status: true } }, flow: true },
      });
      if (!schedule) throw new Error("CHECKIN_SCHEDULE_NOT_FOUND");
      if (schedule.memberId !== input.memberId || schedule.contractCycleId !== input.contractCycleId) throw new Error("CHECKIN_SCOPE_MISMATCH");
      if (schedule.flow) {
        if (input.conversationId && !schedule.flow.conversationId) {
          await tx.flowInstance.update({ where: { id: schedule.flow.id }, data: { conversationId: input.conversationId } });
        }
        return { flowId: schedule.flow.id, scheduleId: schedule.id, state: checkinFlowStateSchema.parse(schedule.flow.context) };
      }

      if (schedule.status === "COMPLETED" || schedule.status === "CANCELLED") throw new Error("CHECKIN_SCHEDULE_NOT_STARTABLE");
      if (schedule.template.status !== "ACTIVE") throw new Error("CHECKIN_TEMPLATE_NOT_ACTIVE");

      const template = checkinTemplateSchema.parse({ id: schedule.template.id, questions: schedule.template.questions });
      const state = startCheckin(template);
      const flow = await tx.flowInstance.create({
        data: {
          householdId: schedule.householdId,
          contractCycleId: schedule.contractCycleId,
          memberId: schedule.memberId,
          conversationId: input.conversationId,
          checkinScheduleId: schedule.id,
          type: "CHECKIN",
          status: "WAITING_USER",
          stepKey: state.currentQuestionKey!,
          context: state as unknown as Prisma.InputJsonValue,
          version: state.version,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
      });
      await tx.checkinSchedule.update({ where: { id: schedule.id }, data: { status: "IN_PROGRESS" } });
      await tx.householdEvent.create({
        data: {
          householdId: schedule.householdId,
          contractCycleId: schedule.contractCycleId,
          memberId: schedule.memberId,
          source: "CHECKIN",
          eventType: "CHECKIN_STARTED",
          occurredAt: now,
          payload: { flowId: flow.id, scheduleId: schedule.id, stage: schedule.stage },
        },
      });
      return { flowId: flow.id, scheduleId: schedule.id, state };
    });
  }

  async submit(input: { flowId: string; memberId: string; contractCycleId: string; expectedVersion: number; questionKey: string; value: string; utterance?: string; now?: Date }) {
    const now = input.now ?? new Date();
    return this.prisma.$transaction(async (tx) => {
      const flow = await tx.flowInstance.findUnique({
        where: { id: input.flowId },
        include: { checkinSchedule: { include: { template: { select: { id: true, questions: true } } } } },
      });
      if (!flow || flow.type !== "CHECKIN" || !flow.checkinSchedule) throw new Error("CHECKIN_FLOW_NOT_FOUND");
      if (flow.memberId !== input.memberId || flow.contractCycleId !== input.contractCycleId) throw new Error("CHECKIN_SCOPE_MISMATCH");
      if (flow.expiresAt <= now) throw new Error("CHECKIN_FLOW_EXPIRED");

      const state = checkinFlowStateSchema.parse(flow.context);
      const template = checkinTemplateSchema.parse({
        id: flow.checkinSchedule.template.id,
        questions: flow.checkinSchedule.template.questions,
      });
      const nextState = submitCheckinAnswer({
        template,
        state,
        expectedVersion: input.expectedVersion,
        questionKey: input.questionKey,
        value: input.value,
      });

      const updated = await tx.flowInstance.updateMany({
        where: { id: flow.id, version: input.expectedVersion, status: "WAITING_USER" },
        data: {
          status: nextState.status,
          stepKey: nextState.currentQuestionKey ?? "completed",
          context: nextState as unknown as Prisma.InputJsonValue,
          version: nextState.version,
        },
      });
      if (updated.count !== 1) throw new Error("CHECKIN_VERSION_CONFLICT");

      if (input.utterance && flow.conversationId) {
        await tx.conversationMessage.create({
          data: {
            conversationId: flow.conversationId,
            direction: "INBOUND",
            kind: "QUICK_REPLY",
            body: input.utterance,
            accessLevel: input.questionKey === "free_text" ? "C" : "A",
          },
        });
        await tx.conversation.update({ where: { id: flow.conversationId }, data: { lastMessageAt: now } });
      }

      if (nextState.status === "COMPLETED") {
        await tx.checkinResponse.create({
          data: {
            checkinScheduleId: flow.checkinSchedule.id,
            respondentMemberId: flow.memberId,
            answers: nextState.answers,
            freeText: nextState.answers.free_text,
            disposition: nextState.disposition,
            completedAt: now,
          },
        });
        await tx.checkinSchedule.update({ where: { id: flow.checkinSchedule.id }, data: { status: "COMPLETED" } });
        await tx.householdEvent.create({
          data: {
            householdId: flow.householdId,
            contractCycleId: flow.contractCycleId,
            memberId: flow.memberId,
            source: "CHECKIN",
            eventType: "CHECKIN_COMPLETED",
            occurredAt: now,
            payload: { flowId: flow.id, scheduleId: flow.checkinSchedule.id, disposition: nextState.disposition },
          },
        });
      }

      return { flowId: flow.id, scheduleId: flow.checkinSchedule.id, state: nextState };
    });
  }
}
