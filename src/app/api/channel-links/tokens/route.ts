import { z } from "zod";
import { getPrisma } from "@/infrastructure/db/client";
import { PrismaLinkingTokenRepository } from "@/infrastructure/db/prisma-linking-token-repository";
import { issueLinkingToken } from "@/modules/kakao/linking-token";
import { hasValidInternalApiKey } from "@/shared/auth/internal-api-key";

const requestSchema = z.object({ memberId: z.string().min(1), contractCycleId: z.string().min(1) });
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasValidInternalApiKey(request)) return Response.json({ error: { code: "UNAUTHORIZED", message: "운영자 인증이 필요합니다.", retryable: false } }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "INVALID_REQUEST", message: "memberId와 contractCycleId가 필요합니다.", retryable: false } }, { status: 400 });
  const prisma = getPrisma();
  const [member, cycle] = await Promise.all([
    prisma.member.findUnique({ where: { id: parsed.data.memberId } }),
    prisma.contractCycle.findUnique({ where: { id: parsed.data.contractCycleId } }),
  ]);
  if (!member || !cycle || member.householdId !== cycle.householdId || cycle.status !== "ACTIVE") {
    return Response.json({ error: { code: "LINK_TARGET_NOT_ELIGIBLE", message: "활성 계약의 구성원을 확인할 수 없습니다.", retryable: false } }, { status: 409 });
  }
  const ttlSeconds = Number(process.env.CHANNEL_LINK_TOKEN_TTL_SECONDS ?? "900");
  const pepper = process.env.PROVIDER_USER_KEY_PEPPER ?? "";
  const result = await issueLinkingToken({ memberId: member.id, householdId: member.householdId, contractCycleId: cycle.id, role: member.role, ttlSeconds, pepper }, new PrismaLinkingTokenRepository(prisma));
  return Response.json({ token: result.token, tokenId: result.tokenId, expiresAt: result.expiresAt.toISOString() }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
