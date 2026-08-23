import { z } from "zod";
import { classificationSchema } from "@/modules/classification/schema";
import { decideInboundAccess } from "@/modules/kakao/inbound-access";
import { identityStatusSchema } from "@/modules/kakao/schema";
import { decideRoute } from "@/modules/routing/decide-route";

const inboundRequestSchema = z.object({
  providerEventId: z.string().min(1),
  providerUserKey: z.string().min(1),
  identityStatus: identityStatusSchema,
  classification: classificationSchema,
});

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const payload = inboundRequestSchema.safeParse(body);
  if (!payload.success) return Response.json({ error: { code: "INVALID_CLASSIFICATION", message: "분류 JSON이 스키마와 일치하지 않습니다.", retryable: false } }, { status: 400 });
  const access = decideInboundAccess(payload.data.identityStatus);
  if (access !== "HOUSEHOLD_LEDGER") {
    return Response.json({ providerEventId: payload.data.providerEventId, access, decision: null, delivery: "BLOCKED_IDENTITY_REQUIRED" }, { status: 202 });
  }
  return Response.json({ providerEventId: payload.data.providerEventId, access, classification: payload.data.classification, decision: decideRoute(payload.data.classification, "UNKNOWN"), delivery: "BLOCKED_HUMAN_REVIEW" }, { status: 202 });
}
