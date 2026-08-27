import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDemoSession, DEMO_SESSION_COOKIE } from "@/modules/demo/session";
import { isDemoEnabled } from "@/modules/demo/server-session";

export const runtime = "nodejs";

const requestSchema = z.object({ alias: z.string().trim().min(1).max(30) });

export async function POST(request: Request) {
  if (!isDemoEnabled()) return NextResponse.json({ ok: false, error: "데모 모드가 비활성화되어 있습니다." }, { status: 404 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.alias.toUpperCase() !== "HOMETO") {
    return NextResponse.json({ ok: false, error: "테스트 별칭 HOMETO를 입력해 주세요." }, { status: 401 });
  }

  try {
    const maxAge = 60 * 60;
    const token = createDemoSession(process.env.DEMO_SESSION_SECRET ?? "", new Date(), maxAge);
    (await cookies()).set(DEMO_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge,
      priority: "high",
    });
    return NextResponse.json({
      ok: true,
      user: { name: "김하늘", role: "GUEST", status: "정상 거주 중" },
      demo: { residenceDay: 3, scenarioDate: "2026-06-02" },
    });
  } catch (error) {
    console.error("Demo session creation failed", error);
    return NextResponse.json({ ok: false, error: "데모 세션 설정을 확인해 주세요." }, { status: 500 });
  }
}
