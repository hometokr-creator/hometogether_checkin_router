import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/infrastructure/db/client";
import { loadCheckinPresentation } from "@/infrastructure/db/load-checkin-presentation";
import { PrismaCheckinFlowService } from "@/infrastructure/db/prisma-checkin-flow-service";
import { demoApiError } from "@/modules/demo/api-error";
import { readDemoSession } from "@/modules/demo/server-session";

export const runtime = "nodejs";

const requestSchema = z.object({
  flowId: z.string().min(1).max(100),
  version: z.number().int().positive(),
  questionKey: z.string().min(1).max(100),
  value: z.string().max(2000),
});

export async function POST(request: Request) {
  const session = await readDemoSession();
  if (!session) return NextResponse.json({ ok: false, error: "데모 로그인이 필요합니다." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "응답 형식이 올바르지 않습니다." }, { status: 400 });

  try {
    const prisma = getPrisma();
    const result = await new PrismaCheckinFlowService(prisma).submit({
      flowId: parsed.data.flowId,
      memberId: session.memberId,
      contractCycleId: session.contractCycleId,
      expectedVersion: parsed.data.version,
      questionKey: parsed.data.questionKey,
      value: parsed.data.value,
    });
    return NextResponse.json({ ok: true, flowId: result.flowId, checkin: await loadCheckinPresentation(prisma, result.state) });
  } catch (error) {
    return demoApiError(error);
  }
}
