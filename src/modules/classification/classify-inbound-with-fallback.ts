import { classifyWithOpenAI } from "@/infrastructure/llm/openai-classifier";
import { CLASSIFICATION_PROMPT } from "@/infrastructure/llm/classification-prompt";
import { createHash } from "node:crypto";
import { classifyInboundMessage } from "./classify-inbound";

export async function classifyInboundWithFallback(utterance: string) {
  const inputHash = createHash("sha256").update(utterance, "utf8").digest("hex");
  const enabled = process.env.LLM_CLASSIFICATION_ENABLED === "true";
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  const promptId = process.env.OPENAI_CLASSIFICATION_PROMPT_ID;
  const promptVersion = process.env.OPENAI_CLASSIFICATION_PROMPT_VERSION;
  if (!enabled || !apiKey || !model) return { classification: classifyInboundMessage(utterance), source: "RULES" as const, modelRun: null };
  try {
    const run = await classifyWithOpenAI({ utterance, apiKey, model, promptId, promptVersion });
    return {
      classification: run.classification,
      source: "OPENAI" as const,
      modelRun: {
        task: "INBOUND_CLASSIFICATION", provider: "OPENAI", model: run.model ?? model,
        status: "SUCCEEDED" as const, promptTemplateKey: CLASSIFICATION_PROMPT.key,
        promptTemplateVersion: CLASSIFICATION_PROMPT.version, providerPromptId: promptId,
        providerPromptVersion: promptVersion, providerResponseId: run.providerResponseId,
        inputHash, output: run.classification, latencyMs: run.latencyMs,
        inputTokens: run.inputTokens, outputTokens: run.outputTokens,
      },
    };
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 160) : "UNKNOWN_ERROR";
    console.error("LLM_CLASSIFICATION_FALLBACK", { error: errorCode });
    return {
      classification: classifyInboundMessage(utterance), source: "RULES_FALLBACK" as const,
      modelRun: {
        task: "INBOUND_CLASSIFICATION", provider: "OPENAI", model,
        status: "FALLBACK" as const, promptTemplateKey: CLASSIFICATION_PROMPT.key,
        promptTemplateVersion: CLASSIFICATION_PROMPT.version, providerPromptId: promptId,
        providerPromptVersion: promptVersion, inputHash, errorCode,
      },
    };
  }
}
