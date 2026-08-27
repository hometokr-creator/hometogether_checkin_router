import { conversationInterpretationSchema, type ConversationInterpretation } from "@/modules/orchestration/schema";
import { CONVERSATION_ROUTER_PROMPT } from "./conversation-router-prompt";

const semanticJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "string", enum: ["SMALL_TALK", "LOOKUP_CONTRACT", "LOOKUP_PAYMENT", "LOOKUP_RULE", "LOOKUP_HOME", "RECORD_SCHEDULE", "REPORT_ISSUE", "FACILITY_REQUEST", "MOVE_OUT_CONSIDERATION", "EMOTIONAL_SIGNAL", "EMERGENCY", "UNKNOWN"] },
    severity: { type: "string", enum: ["S0", "S1", "S2", "S3"] },
    riskFlags: { type: "array", minItems: 1, items: { type: "string", enum: ["SAFETY", "HEALTH", "PRIVACY", "THREAT", "SELF_HARM", "NONE"] } },
    entities: {
      type: "object",
      additionalProperties: false,
      properties: {
        date: { type: ["string", "null"] },
        time: { type: ["string", "null"] },
        location: { type: ["string", "null"] },
        facility: { type: ["string", "null"] },
      },
      required: ["date", "time", "location", "facility"],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reasonCodes: { type: "array", minItems: 1, items: { type: "string" } },
  },
  required: ["intent", "severity", "riskFlags", "entities", "confidence", "reasonCodes"],
} as const;

type OpenAIResponse = {
  id?: string;
  model?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export async function routeConversationWithOpenAI(input: {
  utterance: string;
  apiKey: string;
  model: string;
  promptId?: string;
  promptVersion?: string;
  timeoutMs?: number;
}, fetchImpl: typeof fetch = fetch) {
  const startedAt = Date.now();
  const prompt = input.promptId
    ? { prompt: { id: input.promptId, version: input.promptVersion || undefined, variables: { [CONVERSATION_ROUTER_PROMPT.variableName]: input.utterance } } }
    : { instructions: CONVERSATION_ROUTER_PROMPT.instructions, input: input.utterance };
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(input.timeoutMs ?? 1800),
    body: JSON.stringify({
      model: input.model,
      store: false,
      ...prompt,
      text: { format: { type: "json_schema", name: "residence_conversation_meaning", strict: true, schema: semanticJsonSchema } },
      max_output_tokens: 400,
    }),
  });
  if (!response.ok) throw new Error(`OPENAI_CONVERSATION_ROUTER_HTTP_${response.status}`);
  const body = await response.json() as OpenAIResponse;
  const text = body.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("OPENAI_CONVERSATION_ROUTER_EMPTY");
  return {
    interpretation: conversationInterpretationSchema.parse(JSON.parse(text)) as ConversationInterpretation,
    providerResponseId: body.id,
    model: body.model,
    latencyMs: Date.now() - startedAt,
    inputTokens: body.usage?.input_tokens,
    outputTokens: body.usage?.output_tokens,
  };
}
