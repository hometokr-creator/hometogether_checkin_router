import type { PrismaClient } from "@/generated/prisma/client";
import { checkinFlowStateSchema } from "@/modules/checkin/flow";
import { checkinTemplateSchema } from "@/modules/checkin/template-schema";
import { loadCheckinPresentation } from "./load-checkin-presentation";
import { PrismaCheckinFlowService } from "./prisma-checkin-flow-service";

type KakaoCheckinScope = {
  householdId: string;
  contractCycleId: string;
  memberId: string;
  channelIdentityLinkId: string;
};

export class PrismaKakaoCheckinService {
  constructor(private readonly prisma: PrismaClient) {}

  async start(input: KakaoCheckinScope & { now?: Date }) {
    const now = input.now ?? new Date();
    const link = await this.prisma.channelIdentityLink.findFirst({
      where: {
        id: input.channelIdentityLinkId,
        householdId: input.householdId,
        contractCycleId: input.contractCycleId,
        memberId: input.memberId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!link) throw new Error("CHECKIN_SCOPE_MISMATCH");
    const conflictingFlow = await this.prisma.flowInstance.findFirst({
      where: {
        contractCycleId: input.contractCycleId,
        memberId: input.memberId,
        status: { in: ["IN_PROGRESS", "WAITING_USER"] },
        NOT: { type: "CHECKIN" },
        expiresAt: { gt: now },
      },
      select: { id: true },
    });
    if (conflictingFlow) throw new Error("ACTIVE_FLOW_CONFLICT");
    const conversation = await this.prisma.conversation.upsert({
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
    const schedule = await this.prisma.checkinSchedule.findFirst({
      where: { contractCycleId: input.contractCycleId, memberId: input.memberId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
      orderBy: { scheduledFor: "asc" },
      select: { id: true },
    }) ?? await this.prisma.checkinSchedule.findFirst({
      where: { contractCycleId: input.contractCycleId, memberId: input.memberId, status: "COMPLETED" },
      orderBy: { scheduledFor: "desc" },
      select: { id: true },
    });
    if (!schedule) throw new Error("CHECKIN_SCHEDULE_NOT_FOUND");
    const result = await new PrismaCheckinFlowService(this.prisma).start({
      scheduleId: schedule.id,
      memberId: input.memberId,
      contractCycleId: input.contractCycleId,
      conversationId: conversation.id,
      now,
    });
    return { ...result, checkin: await loadCheckinPresentation(this.prisma, result.state) };
  }

  async consumeActiveReply(input: KakaoCheckinScope & { utterance: string; now?: Date }) {
    const now = input.now ?? new Date();
    const flow = await this.prisma.flowInstance.findFirst({
      where: {
        householdId: input.householdId,
        contractCycleId: input.contractCycleId,
        memberId: input.memberId,
        type: "CHECKIN",
        status: "WAITING_USER",
      },
      include: { checkinSchedule: { include: { template: { select: { id: true, questions: true } } } } },
      orderBy: { updatedAt: "desc" },
    });
    if (!flow || !flow.checkinSchedule) return null;
    if (flow.expiresAt <= now) return null;
    const state = checkinFlowStateSchema.parse(flow.context);
    const template = checkinTemplateSchema.parse({ id: flow.checkinSchedule.template.id, questions: flow.checkinSchedule.template.questions });
    const question = template.questions.find((candidate) => candidate.key === state.currentQuestionKey);
    if (!question) throw new Error("CHECKIN_QUESTION_NOT_FOUND");

    const raw = input.utterance.trim();
    const value = question.type === "SINGLE_CHOICE"
      ? question.options.find((option) => option.label === raw || option.value === raw)?.value
      : raw;
    if (!value) {
      return { handled: true as const, flowId: flow.id, checkin: await loadCheckinPresentation(this.prisma, state), correction: "현재 질문의 선택지 중 하나를 눌러 주세요." };
    }
    const result = await new PrismaCheckinFlowService(this.prisma).submit({
      flowId: flow.id,
      memberId: input.memberId,
      contractCycleId: input.contractCycleId,
      expectedVersion: flow.version,
      questionKey: question.key,
      value,
      utterance: raw,
      now,
    });
    return { handled: true as const, flowId: result.flowId, checkin: await loadCheckinPresentation(this.prisma, result.state) };
  }

  async cancelActiveForEmergency(input: Omit<KakaoCheckinScope, "channelIdentityLinkId">) {
    return this.prisma.$transaction(async (tx) => {
      await tx.flowInstance.updateMany({
        where: {
          householdId: input.householdId,
          contractCycleId: input.contractCycleId,
          memberId: input.memberId,
          type: "CHECKIN",
          status: { in: ["IN_PROGRESS", "WAITING_USER"] },
        },
        data: { status: "CANCELLED", stepKey: "interrupted_by_emergency" },
      });
      await tx.checkinSchedule.updateMany({
        where: { contractCycleId: input.contractCycleId, memberId: input.memberId, status: "IN_PROGRESS" },
        data: { status: "CANCELLED" },
      });
    });
  }
}
