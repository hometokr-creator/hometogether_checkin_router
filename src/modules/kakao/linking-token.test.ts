import { describe, expect, it } from "vitest";
import { consumeLinkingToken, issueLinkingToken, type LinkingTokenRecord, type LinkingTokenRepository } from "./linking-token";

class MemoryRepository implements LinkingTokenRepository {
  records: LinkingTokenRecord[] = []; usedKeys = new Set<string>(); sequence = 0;
  async issueAtomically(record: Omit<LinkingTokenRecord, "id">) { this.records.filter((r) => r.memberId === record.memberId && r.status === "ACTIVE").forEach((r) => { r.status = "REVOKED"; }); const saved = { ...record, id: `token-${++this.sequence}` }; this.records.push(saved); return saved; }
  async consumeAtomically(input: { tokenHash: string; providerUserKeyHash: string; now: Date }) {
    const record = this.records.find((r) => r.tokenHash === input.tokenHash);
    if (!record) return { outcome: "NOT_FOUND" as const };
    if (record.status === "USED") return { outcome: "ALREADY_USED" as const };
    if (record.status !== "ACTIVE" || record.expiresAt <= input.now) { record.status = "EXPIRED"; return { outcome: "EXPIRED" as const }; }
    if (this.usedKeys.has(input.providerUserKeyHash)) return { outcome: "CONFLICT" as const };
    record.status = "USED"; this.usedKeys.add(input.providerUserKeyHash); return { outcome: "LINKED" as const, linkId: `link-${record.id}` };
  }
}

const base = { memberId: "member", householdId: "household", contractCycleId: "cycle", role: "GUEST" as const, ttlSeconds: 900, pepper: "test-only-pepper", now: new Date("2026-08-23T00:00:00Z") };
describe("linking token", () => {
  it("stores a hash rather than the raw token and consumes once", async () => { const repo = new MemoryRepository(); const issued = await issueLinkingToken(base, repo); expect(repo.records[0].tokenHash).not.toBe(issued.token); expect((await consumeLinkingToken({ token: issued.token, providerUserKey: "kakao-user", pepper: base.pepper, now: base.now }, repo)).outcome).toBe("LINKED"); expect((await consumeLinkingToken({ token: issued.token, providerUserKey: "kakao-user", pepper: base.pepper, now: base.now }, repo)).outcome).toBe("ALREADY_USED"); });
  it("rejects expired tokens", async () => { const repo = new MemoryRepository(); const issued = await issueLinkingToken(base, repo); const later = new Date(base.now.getTime() + 901_000); expect((await consumeLinkingToken({ token: issued.token, providerUserKey: "kakao-user", pepper: base.pepper, now: later }, repo)).outcome).toBe("EXPIRED"); });
  it("revokes a previous active token when issuing another", async () => { const repo = new MemoryRepository(); await issueLinkingToken(base, repo); await issueLinkingToken(base, repo); expect(repo.records.map((r) => r.status)).toEqual(["REVOKED", "ACTIVE"]); });
  it("requires a server-side pepper", () => expect(() => consumeLinkingToken({ token: "x", providerUserKey: "y", pepper: "" }, new MemoryRepository())).toThrow("PROVIDER_USER_KEY_PEPPER_REQUIRED"));
});
