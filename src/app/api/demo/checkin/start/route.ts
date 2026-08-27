import { NextResponse } from "next/server";
import { getPrisma } from "@/infrastructure/db/client";
import { loadCheckinPresentation } from "@/infrastructure/db/load-checkin-presentation";
import { PrismaCheckinFlowService } from "@/infrastructure/db/prisma-checkin-flow-service";
import { demoApiError } from "@/modules/demo/api-error";
import { HOMETO_DEMO_SCOPE } from "@/modules/demo/session";
import { readDemoSession } from "@/modules/demo/server-session";

export const runtime = "nodejs";

export async function POST() {
  const session = await readDemoSession();
  if (!session) return NextResponse.json({ ok: false, error: "데모 로그인이 필요합니다." }, { status: 401 });

  try {
    const prisma = getPrisma();
    const result = await new PrismaCheckinFlowService(prisma).start({
      scheduleId: HOMETO_DEMO_SCOPE.scheduleId,
      memberId: session.memberId,
      contractCycleId: session.contractCycleId,
    });
    return NextResponse.json({ ok: true, flowId: result.flowId, checkin: await loadCheckinPresentation(prisma, result.state) });
  } catch (error) {
    return demoApiError(error);
  }
}
