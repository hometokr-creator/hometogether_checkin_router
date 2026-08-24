import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyInboundWithFallback } from "./classify-inbound-with-fallback";

describe("classification latency guard", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the deterministic fast path for a confident kitchen question", async () => {
    vi.stubEnv("LLM_CLASSIFICATION_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", "must-not-be-called");
    vi.stubEnv("OPENAI_MODEL", "must-not-be-called");
    vi.stubEnv("CLASSIFICATION_CONFIDENCE_THRESHOLD", "0.9");

    await expect(classifyInboundWithFallback("주방은 몇 시까지 사용할 수 있나요?"))
      .resolves.toMatchObject({ source: "RULES", classification: { domain: "KITCHEN", confidence: 0.95 } });
  });
});
