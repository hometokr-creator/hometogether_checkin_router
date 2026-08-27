import { createHash } from "node:crypto";
import { CONVERSATION_ROUTER_PROMPT } from "@/infrastructure/llm/conversation-router-prompt";
import { routeConversationWithOpenAI } from "@/infrastructure/llm/openai-conversation-router";
import { interpretConversationDeterministically } from "./interpret-conversation";

export async function interpretConversationWithFallback(utterance: string) {
  const deterministic = interpretConversationDeterministically(utterance);
  if (deterministic.confidence >= 0.85 || deterministic.severity === "S3") {
    return { interpretation: deterministic, source: "RULES" as const, modelRun: null };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (process.env.LLM_CLASSIFICATION_ENABLED !== "true" || !apiKey || !model) {
    return { interpretation: deterministic, source: "RULES" as const, modelRun: null };
  }

  const inputHash = createHash("sha256").update(utterance, "utf8").digest("hex");
  const promptId = process.env.OPENAI_CONVERSATION_ROUTER_PROMPT_ID;
  const promptVersion = process.env.OPENAI_CONVERSATION_ROUTER_PROMPT_VERSION;
  const configuredTimeout = Number(process.env.OPENAI_CLASSIFICATION_TIMEOUT_MS ?? "1800");
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout >= 500 && configuredTimeout <= 4000 ? configuredTimeout : 1800;
  try {
    const run = await routeConversationWithOpenAI({ utterance, apiKey, model, promptId, promptVersion, timeoutMs });
    return {
      interpretation: run.interpretation,
      source: "OPENAI" as const,
      modelRun: {
        task: "CONVERSATION_MEANING_ROUTING",
        provider: "OPENAI",
        model: run.model ?? model,
        status: "SUCCEEDED" as const,
        promptTemplateKey: CONVERSATION_ROUTER_PROMPT.key,
        promptTemplateVersion: CONVERSATION_ROUTER_PROMPT.version,
        providerPromptId: promptId,
        providerPromptVersion: promptVersion,
        providerResponseId: run.providerResponseId,
        inputHash,
        output: run.interpretation,
        latencyMs: run.latencyMs,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
      },
    };
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 160) : "UNKNOWN_ERROR";
    console.error("LLM_CONVERSATION_ROUTER_FALLBACK", { error: errorCode });
    return {
      interpretation: deterministic,
      source: "RULES_FALLBACK" as const,
      modelRun: {
        task: "CONVERSATION_MEANING_ROUTING",
        provider: "OPENAI",
        model,
        status: "FALLBACK" as const,
        promptTemplateKey: CONVERSATION_ROUTER_PROMPT.key,
        promptTemplateVersion: CONVERSATION_ROUTER_PROMPT.version,
        providerPromptId: promptId,
        providerPromptVersion: promptVersion,
        inputHash,
        errorCode,
      },
    };
  }
}
