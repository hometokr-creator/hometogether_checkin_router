import { z } from "zod";
import { getPrisma } from "@/infrastructure/db/client";
import { hasValidInternalApiKey } from "@/shared/auth/internal-api-key";

const statusSchema = z.enum(["REPORTED", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "FOLLOWUP", "CLOSED", "REOPENED"]);
const updateSchema = z.object({ issueId: z.string().min(1), status: statusSchema });

function unauthorized() {
  return Response.json({ error: { message: "운영자 인증이 필요합니다." } }, { status: 401 });
}

export async function GET(request: Request) {
  if (!hasValidInternalApiKey(request)) return unauthorized();
  const issues = await getPrisma().issue.findMany({
    orderBy: { openedAt: "desc" },
    take: 100,
    include: {
      member: { select: { id: true, role: true } },
      tickets: { orderBy: { createdAt: "desc" }, take: 1 },
      events: { where: { eventType: "KAKAO_MESSAGE_RECEIVED" }, orderBy: { occurredAt: "desc" }, take: 1 },
      modelRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return Response.json({
    issues: issues.map((issue) => ({
      id: issue.id,
      householdId: issue.householdId,
      memberId: issue.memberId,
      memberRole: issue.member?.role ?? null,
      status: issue.status,
      route: issue.route,
      intent: issue.intent,
      domain: issue.domain,
      severity: issue.severity,
      urgency: issue.urgency,
      classification: issue.classification,
      utterance: (issue.events[0]?.payload as { utterance?: unknown } | undefined)?.utterance ?? null,
      openedAt: issue.openedAt.toISOString(),
      ticket: issue.tickets[0] ? {
        id: issue.tickets[0].id,
        status: issue.tickets[0].status,
        queue: issue.tickets[0].queue,
        dueAt: issue.tickets[0].dueAt.toISOString(),
      } : null,
      modelRun: issue.modelRuns[0] ? {
        status: issue.modelRuns[0].status,
        model: issue.modelRuns[0].model,
        latencyMs: issue.modelRuns[0].latencyMs,
      } : null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!hasValidInternalApiKey(request)) return unauthorized();
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { message: "문의 ID와 처리 상태를 확인해 주세요." } }, { status: 400 });
  const now = new Date();
  const result = await getPrisma().$transaction(async (tx) => {
    const issue = await tx.issue.update({
      where: { id: parsed.data.issueId },
      data: {
        status: parsed.data.status,
        closedAt: parsed.data.status === "CLOSED" ? now : null,
        tickets: parsed.data.status === "RESOLVED" || parsed.data.status === "CLOSED"
          ? { updateMany: { where: { status: { not: "CLOSED" } }, data: { status: parsed.data.status === "CLOSED" ? "CLOSED" : "RESOLVED" } } }
          : undefined,
      },
    });
    await tx.auditLog.create({
      data: { event: "ISSUE_STATUS_CHANGED", actorId: "OPERATOR_CONSOLE", householdId: issue.householdId, entityType: "Issue", entityId: issue.id, payload: { status: issue.status } },
    });
    return issue;
  });
  return Response.json({ id: result.id, status: result.status });
}
