import { describe, expect, it } from "vitest";
import { createDemoSession, verifyDemoSession } from "./session";

const secret = "test-secret-that-is-at-least-32-characters-long";
const now = new Date("2026-08-27T00:00:00.000Z");

describe("demo session", () => {
  it("round-trips the fixed HOMETO scope", () => {
    const token = createDemoSession(secret, now, 60);
    expect(verifyDemoSession(token, secret, new Date("2026-08-27T00:00:30.000Z"))).toMatchObject({
      householdId: "HT-NW-TEST-001",
      memberId: "GST-HOMETO-001",
      contractCycleId: "CONTRACT-HOMETO-2026-01",
    });
  });

  it("rejects tampered and expired tokens", () => {
    const token = createDemoSession(secret, now, 10);
    expect(verifyDemoSession(`${token}x`, secret, now)).toBeNull();
    expect(verifyDemoSession(token, secret, new Date("2026-08-27T00:00:11.000Z"))).toBeNull();
  });

  it("requires a sufficiently strong signing secret", () => {
    expect(() => createDemoSession("short", now)).toThrow("DEMO_SESSION_SECRET_TOO_SHORT");
  });
});
