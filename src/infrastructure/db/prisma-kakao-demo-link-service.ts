import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { HOMETO_DEMO_SCOPE } from "@/modules/demo/session";

export class PrismaKakaoDemoLinkService {
  constructor(private readonly prisma: PrismaClient) {}

  async link(input: { providerUserKeyHash: string; utterance: string; now?: Date }) {
    const now = input.now ?? new Date();
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.member.findFirst({
        where: { id: HOMETO_DEMO_SCOPE.memberId, householdId: HOMETO_DEMO_SCOPE.householdId, role: "GUEST" },
        select: { id: true, householdId: true, role: true },
      });
      const contract = await tx.contractCycle.findFirst({
        where: { id: HOMETO_DEMO_SCOPE.contractCycleId, householdId: HOMETO_DEMO_SCOPE.householdId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!member || !contract) throw new Error("KAKAO_DEMO_SCOPE_NOT_READY");

      const conflict = await tx.channelIdentityLink.findFirst({
        where: { provider: "KAKAO", providerUserKeyHash: input.providerUserKeyHash, status: "ACTIVE", NOT: { memberId: member.id } },
        select: { id: true },
      });
      if (conflict) return { outcome: "CONFLICT" as const };

      const link = await tx.channelIdentityLink.upsert({
        where: {
          provider_providerUserKeyHash_contractCycleId: {
            provider: "KAKAO",
            providerUserKeyHash: input.providerUserKeyHash,
            contractCycleId: contract.id,
          },
        },
        update: { memberId: member.id, householdId: member.householdId, role: member.role, status: "ACTIVE", verifiedAt: now, revokedAt: null },
        create: {
          provider: "KAKAO",
          providerUserKeyHash: input.providerUserKeyHash,
          memberId: member.id,
          householdId: member.householdId,
          contractCycleId: contract.id,
          role: member.role,
          status: "ACTIVE",
          verifiedAt: now,
        },
      });
      const conversation = await tx.conversation.upsert({
        where: { channelIdentityLinkId: link.id },
        update: { status: "ACTIVE", lastMessageAt: now },
        create: {
          householdId: member.householdId,
          contractCycleId: contract.id,
          memberId: member.id,
          channelIdentityLinkId: link.id,
          channel: "KAKAO",
          lastMessageAt: now,
        },
      });
      const message = await tx.conversationMessage.create({
        data: { conversationId: conversation.id, direction: "INBOUND", kind: "TEXT", body: input.utterance, accessLevel: "A" },
      });
      await tx.auditLog.create({
        data: {
          event: "KAKAO_DEMO_IDENTITY_LINKED",
          householdId: member.householdId,
          entityType: "ChannelIdentityLink",
          entityId: link.id,
          payload: { memberId: member.id, contractCycleId: contract.id, conversationId: conversation.id, messageId: message.id },
        },
      });
      return { outcome: "LINKED" as const, linkId: link.id, conversationId: conversation.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
