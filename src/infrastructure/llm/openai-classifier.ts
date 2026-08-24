import { classificationSchema, type ClassificationResult } from "@/modules/classification/schema";
import { CLASSIFICATION_PROMPT } from "./classification-prompt";

const classificationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "string", enum: ["QUESTION", "REQUEST", "COMPLAINT", "REPORT", "CHANGE", "EMERGENCY", "FEEDBACK", "UNKNOWN"] },
    domain: { type: "string", enum: ["FAQ", "CONTRACT", "SETTLEMENT", "NOISE", "CLEANING", "PRIVACY", "SPACE", "KITCHEN", "VISITOR", "RELATIONSHIP", "FACILITY", "SAFETY", "HEALTH", "RETENTION", "OTHER"] },
    severity: { type: "string", enum: ["S1", "S2", "S3"] },
    urgency: { type: "string", enum: ["NORMAL", "SAME_DAY", "IMMEDIATE"] },
    direction: { type: "string", enum: ["G_TO_H", "H_TO_G", "MUTUAL", "NOT_APPLICABLE"] },
    interventionPreference: { type: "string", enum: ["LISTEN_ONLY", "COORDINATE", "URGENT", "UNKNOWN"] },
    distressSignal: { type: "string", enum: ["NONE", "POSSIBLE", "EXPLICIT"] },
    riskFlags: { type: "array", items: { type: "string", enum: ["SAFETY", "HEALTH", "MONEY", "PRIVACY", "EXIT", "DIRECT_DEAL", "THREAT", "SELF_HARM", "LEGAL", "NONE"] } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidenceMessageIds: { type: "array", items: { type: "string" } },
    reasonCodes: { type: "array", items: { type: "string" } },
  },
  required: ["intent", "domain", "severity", "urgency", "direction", "interventionPreference", "distressSignal", "riskFlags", "confidence", "evidenceMessageIds", "reasonCodes"],
} as const;

type OpenAIResponse = {
  id?: string;
  model?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export type OpenAIClassificationRun = {
  classification: ClassificationResult;
  providerResponseId?: string;
  model?: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
};

export async function classifyWithOpenAI(input: {
  utterance: string;
  apiKey: string;
  model: string;
  promptId?: string;
  promptVersion?: string;
  timeoutMs?: number;
}, fetchImpl: typeof fetch = fetch): Promise<OpenAIClassificationRun> {
  const startedAt = Date.now();
  const prompt = input.promptId
    ? { prompt: { id: input.promptId, version: input.promptVersion || undefined, variables: { [CLASSIFICATION_PROMPT.variableName]: input.utterance } } }
    : { instructions: CLASSIFICATION_PROMPT.instructions, input: input.utterance };
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(input.timeoutMs ?? 4000),
    body: JSON.stringify({
      model: input.model,
      store: false,
      ...prompt,
      text: { format: { type: "json_schema", name: "residence_classification", strict: true, schema: classificationJsonSchema } },
      max_output_tokens: 500,
    }),
  });
  if (!response.ok) throw new Error(`OPENAI_CLASSIFICATION_HTTP_${response.status}`);
  const body = await response.json() as OpenAIResponse;
  const text = body.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("OPENAI_CLASSIFICATION_EMPTY");
  return {
    classification: classificationSchema.parse(JSON.parse(text)),
    providerResponseId: body.id,
    model: body.model,
    latencyMs: Date.now() - startedAt,
    inputTokens: body.usage?.input_tokens,
    outputTokens: body.usage?.output_tokens,
  };
}
