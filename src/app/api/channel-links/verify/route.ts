import { z } from "zod";
import { getPrisma } from "@/infrastructure/db/client";
import { PrismaLinkingTokenRepository } from "@/infrastructure/db/prisma-linking-token-repository";
import { consumeLinkingToken } from "@/modules/kakao/linking-token";

const requestSchema = z.object({ token: z.string().min(20), providerUserKey: z.string().min(1) });
export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "INVALID_REQUEST", message: "연결 정보를 다시 확인해 주세요.", retryable: false } }, { status: 400 });
  const result = await consumeLinkingToken({ ...parsed.data, pepper: process.env.PROVIDER_USER_KEY_PEPPER ?? "" }, new PrismaLinkingTokenRepository(getPrisma()));
  if (result.outcome === "CONFLICT") return Response.json({ error: { code: "IDENTITY_CONFLICT", message: "담당자 확인이 필요합니다.", retryable: false } }, { status: 409 });
  if (result.outcome !== "LINKED") return Response.json({ error: { code: "LINK_TOKEN_INVALID", message: "연결 코드가 만료되었거나 이미 사용되었습니다.", retryable: false } }, { status: 410 });
  return Response.json({ status: "LINKED", linkId: result.linkId }, { headers: { "Cache-Control": "no-store" } });
}
