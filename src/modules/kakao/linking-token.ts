import { createHash, randomBytes } from "node:crypto";

export interface LinkingTokenRecord {
  id: string; tokenHash: string; memberId: string; householdId: string; contractCycleId: string;
  role: "GUEST" | "HOST"; status: "ACTIVE" | "USED" | "EXPIRED" | "REVOKED"; expiresAt: Date;
}

export interface ConsumeTokenResult {
  outcome: "LINKED" | "NOT_FOUND" | "EXPIRED" | "ALREADY_USED" | "CONFLICT";
  linkId?: string;
}

export interface LinkingTokenRepository {
  issueAtomically(record: Omit<LinkingTokenRecord, "id">, now: Date): Promise<LinkingTokenRecord>;
  consumeAtomically(input: { tokenHash: string; providerUserKeyHash: string; now: Date }): Promise<ConsumeTokenResult>;
}

export function hashSecret(value: string, pepper: string) {
  if (!pepper) throw new Error("PROVIDER_USER_KEY_PEPPER_REQUIRED");
  return createHash("sha256").update(`${pepper}:${value}`).digest("hex");
}

export async function issueLinkingToken(input: {
  memberId: string; householdId: string; contractCycleId: string; role: "GUEST" | "HOST";
  ttlSeconds: number; pepper: string; now?: Date;
}, repository: LinkingTokenRepository) {
  if (!Number.isInteger(input.ttlSeconds) || input.ttlSeconds < 60) throw new Error("INVALID_LINK_TOKEN_TTL");
  const now = input.now ?? new Date();
  const token = randomBytes(32).toString("base64url");
  const record = await repository.issueAtomically({
    tokenHash: hashSecret(token, input.pepper), memberId: input.memberId, householdId: input.householdId,
    contractCycleId: input.contractCycleId, role: input.role, status: "ACTIVE", expiresAt: new Date(now.getTime() + input.ttlSeconds * 1000),
  }, now);
  return { token, tokenId: record.id, expiresAt: record.expiresAt };
}

export function consumeLinkingToken(input: { token: string; providerUserKey: string; pepper: string; now?: Date }, repository: LinkingTokenRepository) {
  return repository.consumeAtomically({ tokenHash: hashSecret(input.token, input.pepper), providerUserKeyHash: hashSecret(input.providerUserKey, input.pepper), now: input.now ?? new Date() });
}
