/**
 * M1 意图分析模块
 */

import { callLLM, LLMError, type LLMClientConfig } from "@/lib/llm-client";
import { validateIntentAnalysis } from "@/lib/validators";
import { SYSTEM_PROMPT } from "@/agent/prompts/system";
import { buildM1Prompt } from "@/agent/prompts/m1-intent";
import type { IntentAnalysis } from "@/types/intent";
import type { DocumentContext } from "@/types/api";

export interface AnalyzeIntentOptions {
  purpose?: string;
  audience?: string;
  /** 上传的文档（用于场景判断） */
  documents?: DocumentContext[];
  /** 用户手动指定的场景类型 */
  scenarioType?: "A" | "B" | "C";
}

export async function analyzeIntent(
  userInput: string,
  config: LLMClientConfig,
  options?: AnalyzeIntentOptions
): Promise<IntentAnalysis> {
  console.log("[M1] 开始意图分析...");

  const userPrompt = buildM1Prompt(userInput, options);

  const rawResult = await callLLM<unknown>(SYSTEM_PROMPT, userPrompt, config, {
    temperature: 0.3,
    maxTokens: 1024,
  });

  try {
    const intent = validateIntentAnalysis(rawResult);
    console.log(`[M1] 完成: 用途="${intent.purpose}", 受众="${intent.audience}"`);
    return intent;
  } catch (validationError) {
    console.error("[M1] 校验失败，原始输出:", JSON.stringify(rawResult));
    throw new LLMError(
      validationError instanceof Error ? validationError.message : "M1 输出结构校验失败",
      "PARSE_ERROR"
    );
  }
}
