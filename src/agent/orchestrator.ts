/**
 * Agent 编排器
 * M1 → M3 → M4（流式）
 */

import { analyzeIntent } from "@/agent/modules/m1-intent-analyzer";
import { buildStoryline } from "@/agent/modules/m3-storyline-builder";
import { generateDetailedOutline } from "@/agent/modules/m4-outline-generator";
import { LLMError, type LLMClientConfig } from "@/lib/llm-client";
import type { GenerateRequest, SSEEvent } from "@/types/api";
import type { PPTOutline } from "@/types/outline";

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 1,
  stepName: string = "未知步骤"
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("未知错误");
      if (error instanceof LLMError && error.code === "API_ERROR") throw error;
      if (attempt < maxRetries) {
        console.warn(`[Orchestrator] ${stepName} 第 ${attempt + 1} 次失败，重试中...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
  throw lastError ?? new Error(`${stepName} 失败`);
}

export async function generateOutline(
  input: GenerateRequest,
  onEvent: (event: SSEEvent) => void
): Promise<PPTOutline> {
  const docCount = input.documents?.length ?? 0;
  console.log(`[Orchestrator] 开始，输入长度: ${input.userInput.length} 字，文档数: ${docCount}`);

  const config: LLMClientConfig = {
    apiKey: input.llmConfig.apiKey,
    baseURL: input.llmConfig.baseUrl,
    model: input.llmConfig.model,
  };

  // ── M1 意图分析 ──────────────────────────────────────────────
  onEvent({ type: "status", step: "intent", message: "正在分析你的需求..." });

  let intentResult;
  try {
    intentResult = await withRetry(
      () => analyzeIntent(input.userInput, config, {
        purpose: input.purpose,
        audience: input.audience,
        documents: input.documents,
        scenarioType: input.scenarioType,
      }),
      1, "M1 意图分析"
    );
  } catch (error) {
    onEvent({ type: "error", message: `需求分析失败：${error instanceof Error ? error.message : "未知错误"}`, code: "LLM_ERROR" });
    throw error;
  }
  onEvent({ type: "intent", data: intentResult });

  console.log(`[Orchestrator] 场景判断结果: ${intentResult.scenarioType}`);

  // ── M3 故事线 ────────────────────────────────────────────────
  onEvent({ type: "status", step: "storyline", message: "正在构建故事线..." });

  let storylineResult;
  try {
    storylineResult = await withRetry(
      () => buildStoryline(input.userInput, intentResult, config, input.pageCount),
      1, "M3 故事线构建"
    );
  } catch (error) {
    onEvent({ type: "error", message: `故事线构建失败：${error instanceof Error ? error.message : "未知错误"}`, code: "LLM_ERROR" });
    throw error;
  }
  onEvent({ type: "storyline", data: storylineResult });

  // ── M4 大纲生成（流式）──────────────────────────────────────
  onEvent({ type: "status", step: "outline", message: "正在生成详细大纲..." });

  let outline;
  try {
    // M4 不再 withRetry，因为流式输出中途失败重试意义不大
    outline = await generateDetailedOutline(
      input.userInput,
      intentResult,
      storylineResult,
      config,
      (page, index) => {
        // 每解析出一页就立即推送
        onEvent({ type: "page", data: page, index });
      },
      input.documents  // 将文档内容传给 M4，用于场景A/C的内容参考
    );
  } catch (error) {
    onEvent({ type: "error", message: `大纲生成失败：${error instanceof Error ? error.message : "未知错误"}`, code: "LLM_ERROR" });
    throw error;
  }

  // 流式完成后推送完整校验大纲（前端用于最终状态更新）
  onEvent({ type: "outline", data: outline });
  onEvent({ type: "done" });

  console.log("[Orchestrator] 全流程完成！");
  return outline;
}
