import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { PrismaKakaoDemoLinkService } from "./prisma-kakao-demo-link-service";

function harness(conflict = false) {
  const linkUpsert = vi.fn(async () => ({ id: "link-1" }));
  const tx = {
    member: { findFirst: vi.fn(async () => ({ id: "GST-HOMETO-001", householdId: "HT-NW-TEST-001", role: "GUEST" })) },
    contractCycle: { findFirst: vi.fn(async () => ({ id: "CONTRACT-HOMETO-2026-01" })) },
    channelIdentityLink: {
      findFirst: vi.fn(async () => conflict ? ({ id: "other-link" }) : null),
      upsert: linkUpsert,
    },
    conversation: { upsert: vi.fn(async () => ({ id: "conversation-1" })) },
    conversationMessage: { create: vi.fn(async () => ({ id: "message-1" })) },
    auditLog: { create: vi.fn(async () => ({ id: "audit-1" })) },
  };
  const prisma = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaClient;
  return { service: new PrismaKakaoDemoLinkService(prisma), linkUpsert };
}

describe("Prisma Kakao demo link", () => {
  it("links only the fixed HOMETO member and contract scope", async () => {
    const { service, linkUpsert } = harness();
    const result = await service.link({ providerUserKeyHash: "hashed-user-key", utterance: "HOMETO", now: new Date("2026-08-27T00:00:00.000Z") });
    expect(result).toMatchObject({ outcome: "LINKED", linkId: "link-1", conversationId: "conversation-1" });
    expect(linkUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        providerUserKeyHash: "hashed-user-key",
        memberId: "GST-HOMETO-001",
        householdId: "HT-NW-TEST-001",
        contractCycleId: "CONTRACT-HOMETO-2026-01",
      }),
    }));
  });

  it("does not overwrite a Kakao account linked to another member", async () => {
    const { service, linkUpsert } = harness(true);
    expect(await service.link({ providerUserKeyHash: "hashed-user-key", utterance: "HOMETO" })).toEqual({ outcome: "CONFLICT" });
    expect(linkUpsert).not.toHaveBeenCalled();
  });
});
