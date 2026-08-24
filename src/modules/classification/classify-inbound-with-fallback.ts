import { classifyWithOpenAI } from "@/infrastructure/llm/openai-classifier";
import { classifyInboundMessage } from "./classify-inbound";

export async function classifyInboundWithFallback(utterance: string) {
  const enabled = process.env.LLM_CLASSIFICATION_ENABLED === "true";
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!enabled || !apiKey || !model) return { classification: classifyInboundMessage(utterance), source: "RULES" as const };
  try {
    return { classification: await classifyWithOpenAI({ utterance, apiKey, model }), source: "OPENAI" as const };
  } catch (error) {
    console.error("LLM_CLASSIFICATION_FALLBACK", { error: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
    return { classification: classifyInboundMessage(utterance), source: "RULES_FALLBACK" as const };
  }
}
