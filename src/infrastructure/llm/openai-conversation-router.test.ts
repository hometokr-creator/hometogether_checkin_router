import { describe, expect, it, vi } from "vitest";
import { routeConversationWithOpenAI } from "./openai-conversation-router";

describe("OpenAI conversation meaning router", () => {
  it("parses semantic output without action fields", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: "resp-1",
      model: "test-model",
      output: [{ content: [{ type: "output_text", text: JSON.stringify({
        intent: "EMOTIONAL_SIGNAL",
        severity: "S2",
        riskFlags: ["NONE"],
        entities: { date: null, time: null, location: null, facility: null },
        confidence: 0.78,
        reasonCodes: ["AMBIGUOUS_MEANING"],
      }) }] }],
    }), { status: 200 })) as unknown as typeof fetch;
    const result = await routeConversationWithOpenAI({ utterance: "여기 살기 싫어요", apiKey: "key", model: "test-model" }, fetchMock);
    expect(result.interpretation).toMatchObject({ intent: "EMOTIONAL_SIGNAL", severity: "S2" });
    const requestBody = JSON.parse(String((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]?.body));
    expect(requestBody.text.format.schema.properties).not.toHaveProperty("proposedAction");
  });
});
