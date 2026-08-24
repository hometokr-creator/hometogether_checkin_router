import { describe, expect, it } from "vitest";
import { classifyWithOpenAI } from "./openai-classifier";

describe("OpenAI structured classifier", () => {
  it("validates structured output before returning it", async () => {
    const output = { intent: "QUESTION", domain: "KITCHEN", severity: "S1", urgency: "NORMAL", direction: "NOT_APPLICABLE", interventionPreference: "UNKNOWN", distressSignal: "NONE", riskFlags: ["NONE"], confidence: 0.91, evidenceMessageIds: ["KAKAO_CURRENT_MESSAGE"], reasonCodes: ["KITCHEN_HOURS_QUESTION"] };
    const fakeFetch = async () => new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }] }), { status: 200 });
    await expect(classifyWithOpenAI({ utterance: "주방 몇 시까지?", apiKey: "test", model: "test" }, fakeFetch as typeof fetch)).resolves.toMatchObject({ classification: output });
  });
  it("rejects invalid model output", async () => {
    const fakeFetch = async () => new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: '{"domain":"MADE_UP"}' }] }] }), { status: 200 });
    await expect(classifyWithOpenAI({ utterance: "문의", apiKey: "test", model: "test" }, fakeFetch as typeof fetch)).rejects.toThrow();
  });
  it("uses a reusable prompt id, version, and variable when configured", async () => {
    const output = { intent: "QUESTION", domain: "KITCHEN", severity: "S1", urgency: "NORMAL", direction: "NOT_APPLICABLE", interventionPreference: "UNKNOWN", distressSignal: "NONE", riskFlags: ["NONE"], confidence: 0.91, evidenceMessageIds: ["KAKAO_CURRENT_MESSAGE"], reasonCodes: ["KITCHEN_HOURS_QUESTION"] };
    let requestBody: Record<string, unknown> = {};
    const fakeFetch = async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: "resp_test", model: "test", output: [{ content: [{ type: "output_text", text: JSON.stringify(output) }] }] }), { status: 200 });
    };
    await classifyWithOpenAI({ utterance: "주방 몇 시까지?", apiKey: "test", model: "test", promptId: "pmpt_123", promptVersion: "2" }, fakeFetch as typeof fetch);
    expect(requestBody).toMatchObject({ prompt: { id: "pmpt_123", version: "2", variables: { utterance: "주방 몇 시까지?" } } });
    expect(requestBody).not.toHaveProperty("instructions");
  });
});
