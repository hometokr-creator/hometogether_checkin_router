import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const DEMO_SESSION_COOKIE = "hometo_demo_session";
export const HOMETO_DEMO_SCOPE = {
  householdId: "HT-NW-TEST-001",
  memberId: "GST-HOMETO-001",
  contractCycleId: "CONTRACT-HOMETO-2026-01",
  scheduleId: "CHECKIN-HOMETO-D3-DEMO",
} as const;

const claimsSchema = z.object({
  householdId: z.literal(HOMETO_DEMO_SCOPE.householdId),
  memberId: z.literal(HOMETO_DEMO_SCOPE.memberId),
  contractCycleId: z.literal(HOMETO_DEMO_SCOPE.contractCycleId),
  exp: z.number().int().positive(),
});

export type DemoSessionClaims = z.infer<typeof claimsSchema>;

function sign(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createDemoSession(secret: string, now = new Date(), ttlSeconds = 60 * 60): string {
  if (secret.length < 32) throw new Error("DEMO_SESSION_SECRET_TOO_SHORT");
  const claims: DemoSessionClaims = {
    householdId: HOMETO_DEMO_SCOPE.householdId,
    memberId: HOMETO_DEMO_SCOPE.memberId,
    contractCycleId: HOMETO_DEMO_SCOPE.contractCycleId,
    exp: Math.floor(now.getTime() / 1000) + ttlSeconds,
  };
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyDemoSession(token: string, secret: string, now = new Date()): DemoSessionClaims | null {
  if (secret.length < 32) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = sign(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const claims = claimsSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    return claims.exp > Math.floor(now.getTime() / 1000) ? claims : null;
  } catch {
    return null;
  }
}
