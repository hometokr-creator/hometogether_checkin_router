import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { startFacilityTriage, submitFacilityReply } from "@/modules/facility/flow";
import { PrismaFacilityTriageService } from "./prisma-facility-triage-service";

const scope = {
  householdId: "household-1",
  contractCycleId: "contract-1",
  memberId: "member-1",
  channelIdentityLinkId: "link-1",
};

function createConsumeHarness(outcome: "RESOLVED" | "NEEDS_OPERATOR" | "EMERGENCY", priorIssues: Array<{ id: string; severity: string; classification: unknown }> = []) {
  const started = startFacilityTriage({ description: "와이파이가 안 돼요", initialMessageId: "initial-message" });
  const state = outcome === "EMERGENCY"
    ? started
    : submitFacilityReply({ state: started, expectedVersion: 1, value: "FACILITY_SAFETY:SAFE" });
  const utterance = outcome === "RESOLVED"
    ? "FACILITY_RESULT:RESOLVED"
    : outcome === "NEEDS_OPERATOR"
      ? "FACILITY_RESULT:UNRESOLVED"
      : "FACILITY_SAFETY:DANGER";
  const issueCreate = vi.fn(async () => ({ id: "issue-1" }));
  const issueFindMany = vi.fn(async () => priorIssues);
  const ticketCreate = vi.fn(async () => ({ id: "ticket-1" }));
  const tx = {
    flowInstance: {
      findFirst: vi.fn(async () => ({
        id: "flow-1",
        householdId: scope.householdId,
        contractCycleId: scope.contractCycleId,
        memberId: scope.memberId,
        conversationId: "conversation-1",
        type: "FACILITY_TRIAGE",
        status: "WAITING_USER",
        context: state,
        version: state.version,
        expiresAt: new Date("2026-08-28T00:00:00.000Z"),
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    conversation: { update: vi.fn(async () => ({ id: "conversation-1" })) },
    conversationMessage: { create: vi.fn(async () => ({ id: "reply-message" })) },
    issue: { create: issueCreate, findMany: issueFindMany },
    actionTicket: { create: ticketCreate },
    householdEvent: { create: vi.fn(async () => ({ id: "event-1" })) },
    auditLog: { create: vi.fn(async () => ({ id: "audit-1" })) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaClient;
  return { service: new PrismaFacilityTriageService(prisma), issueCreate, issueFindMany, ticketCreate, utterance };
}

describe("Prisma facility triage persistence", () => {
  it("does not open an issue when self-help resolves the problem", async () => {
    const harness = createConsumeHarness("RESOLVED");
    const result = await harness.service.consumeActiveReply({ ...scope, utterance: harness.utterance, now: new Date("2026-08-27T00:00:00.000Z") });
    expect(result?.presentation.outcome).toBe("RESOLVED");
    expect(harness.issueCreate).not.toHaveBeenCalled();
    expect(harness.ticketCreate).not.toHaveBeenCalled();
  });

  it("opens an S1 operator issue only after unresolved self-help", async () => {
    const harness = createConsumeHarness("NEEDS_OPERATOR");
    await harness.service.consumeActiveReply({ ...scope, utterance: harness.utterance, now: new Date("2026-08-27T00:00:00.000Z") });
    expect(harness.issueCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ severity: "S1", domain: "FACILITY", route: "B" }) }));
    expect(harness.ticketCreate).toHaveBeenCalledOnce();
  });

  it("promotes a recurring facility issue to S2 with an eight-hour ticket", async () => {
    const harness = createConsumeHarness("NEEDS_OPERATOR", [
      { id: "prior-wifi", severity: "S1", classification: { source: "FACILITY_TRIAGE", facility: "WIFI" } },
    ]);
    const now = new Date("2026-08-27T00:00:00.000Z");
    await harness.service.consumeActiveReply({ ...scope, utterance: harness.utterance, now });
    expect(harness.issueFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        householdId: scope.householdId,
        contractCycleId: scope.contractCycleId,
        memberId: scope.memberId,
        domain: "FACILITY",
      }),
      take: 20,
    }));
    expect(harness.issueCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        severity: "S2",
        urgency: "SAME_DAY",
        classification: expect.objectContaining({ occurrenceNumber: 2, priorIssueIds: ["prior-wifi"] }),
      }),
    }));
    expect(harness.ticketCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ dueAt: new Date("2026-08-27T08:00:00.000Z") }),
    }));
  });

  it("opens an S3 operator issue for contextual danger", async () => {
    const harness = createConsumeHarness("EMERGENCY");
    await harness.service.consumeActiveReply({ ...scope, utterance: harness.utterance, now: new Date("2026-08-27T00:00:00.000Z") });
    expect(harness.issueCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ severity: "S3", urgency: "IMMEDIATE" }) }));
  });
});
