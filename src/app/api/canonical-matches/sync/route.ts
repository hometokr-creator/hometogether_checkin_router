import { z } from "zod";
import { getPrisma } from "@/infrastructure/db/client";
import { syncCanonicalMatch } from "@/modules/canonical/sync-match";
import { hasValidInternalApiKey } from "@/shared/auth/internal-api-key";

const requestSchema = z.object({ matchId: z.uuid() });
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasValidInternalApiKey(request)) return Response.json({ error: { code: "UNAUTHORIZED", message: "운영자 인증이 필요합니다.", retryable: false } }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "INVALID_REQUEST", message: "유효한 matchId가 필요합니다.", retryable: false } }, { status: 400 });
  const result = await syncCanonicalMatch(getPrisma(), parsed.data.matchId);
  if (!result) return Response.json({ error: { code: "CANONICAL_MATCH_NOT_ELIGIBLE", message: "활성 원장 매칭과 구성원을 확인할 수 없습니다.", retryable: false } }, { status: 409 });
  return Response.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
}
