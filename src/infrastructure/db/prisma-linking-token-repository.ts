import type { PrismaClient } from "@/generated/prisma/client";
import type { ConsumeTokenResult, LinkingTokenRecord, LinkingTokenRepository } from "@/modules/kakao/linking-token";

export class PrismaLinkingTokenRepository implements LinkingTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async issueAtomically(record: Omit<LinkingTokenRecord, "id">, now: Date): Promise<LinkingTokenRecord> {
    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.channelLinkingToken.updateMany({ where: { memberId: record.memberId, status: "ACTIVE" }, data: { status: "REVOKED", usedAt: now } });
      return tx.channelLinkingToken.create({
        data: { tokenHash: record.tokenHash, memberId: record.memberId, contractCycleId: record.contractCycleId, status: record.status, expiresAt: record.expiresAt },
      });
    });
    return { ...record, id: saved.id };
  }

  async consumeAtomically(input: { tokenHash: string; providerUserKeyHash: string; now: Date }): Promise<ConsumeTokenResult> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.channelLinkingToken.findUnique({
        where: { tokenHash: input.tokenHash },
        include: { member: true, contractCycle: true },
      });
      if (!token) return { outcome: "NOT_FOUND" };
      if (token.status === "USED") return { outcome: "ALREADY_USED" };
      if (token.status !== "ACTIVE" || token.expiresAt <= input.now || token.contractCycle.status !== "ACTIVE") {
        if (token.status === "ACTIVE") await tx.channelLinkingToken.update({ where: { id: token.id }, data: { status: "EXPIRED" } });
        return { outcome: "EXPIRED" };
      }
      const conflict = await tx.channelIdentityLink.findFirst({
        where: { provider: "KAKAO", providerUserKeyHash: input.providerUserKeyHash, status: "ACTIVE", NOT: { memberId: token.memberId } },
        select: { id: true },
      });
      if (conflict) return { outcome: "CONFLICT" };
      const used = await tx.channelLinkingToken.updateMany({ where: { id: token.id, status: "ACTIVE" }, data: { status: "USED", usedAt: input.now } });
      if (used.count !== 1) return { outcome: "ALREADY_USED" };
      const link = await tx.channelIdentityLink.upsert({
        where: { provider_providerUserKeyHash_contractCycleId: { provider: "KAKAO", providerUserKeyHash: input.providerUserKeyHash, contractCycleId: token.contractCycleId } },
        update: { memberId: token.memberId, householdId: token.member.householdId, role: token.member.role, status: "ACTIVE", verifiedAt: input.now, revokedAt: null },
        create: { provider: "KAKAO", providerUserKeyHash: input.providerUserKeyHash, memberId: token.memberId, householdId: token.member.householdId, contractCycleId: token.contractCycleId, role: token.member.role, status: "ACTIVE", verifiedAt: input.now },
      });
      await tx.auditLog.create({ data: { event: "CHANNEL_IDENTITY_LINKED", householdId: token.member.householdId, entityType: "ChannelIdentityLink", entityId: link.id, payload: { provider: "KAKAO", memberId: token.memberId, contractCycleId: token.contractCycleId } } });
      return { outcome: "LINKED", linkId: link.id };
    });
  }
}
