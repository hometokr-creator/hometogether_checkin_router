import { afterEach, describe, expect, it } from "vitest";
import { POST as issueToken } from "./tokens/route";
import { POST as verifyToken } from "./verify/route";

const originalKey = process.env.INTERNAL_API_KEY;
afterEach(() => { if (originalKey === undefined) delete process.env.INTERNAL_API_KEY; else process.env.INTERNAL_API_KEY = originalKey; });

describe("channel link routes", () => {
  it("rejects token issuance without operator authentication before DB access", async () => {
    process.env.INTERNAL_API_KEY = "server-secret";
    const response = await issueToken(new Request("http://localhost/api/channel-links/tokens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: "member", contractCycleId: "cycle" }) }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });
  it("rejects malformed verification input before DB access", async () => {
    const response = await verifyToken(new Request("http://localhost/api/channel-links/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "short", providerUserKey: "" }) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
  });
});
