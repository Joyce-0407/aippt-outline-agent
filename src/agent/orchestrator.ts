/**
 * Agent 编排器
 * M1 → M3 → M4（流式）
 */

import { analyzeIntent } from "@/agent/modules/m1-intent-analyzer";
import { buildStoryline } from "@/agent/modules/m3-storyline-builder";
import { generateDetailedOutline } from "@/agent/modules/m4-outline-generator";
import { researchTopic } from "@/agent/modules/m2-researcher";
import { LLMError, type LLMClientConfig } from "@/lib/llm-client";
import type { GenerateRequest, SSEEvent, DocumentContext } from "@/types/api";
import type { PPTOutline } from "@/types/outline";
import type { Storyline } from "@/types/storyline";


function getStructuredDocumentPageCount(documents?: DocumentContext[]): number | null {
  if (!documents || documents.length === 0) return null;

  const structuredDocs = documents.filter((doc) => doc.hasPageStructure);
  if (structuredDocs.length === 0) return null;

  const pageCounts = structuredDocs
    .map((doc) => doc.pageCount ?? doc.pages?.length ?? 0)
    .filter((count) => count > 0);

  if (pageCounts.length === 0) return null;

  // 多文档时取页数最大的结构化文档，避免被短文档截断
  return Math.max(...pageCounts);
}

function enforceTotalPages(storyline: Storyline, targetPages: number): Storyline {
  if (storyline.totalPages === targetPages) return storyline;

  if (!storyline.sections.length) {
    return { ...storyline, totalPages: targetPages };
  }

  const adjustedSections = storyline.sections.map((section) => ({
    ...section,
    pageRange: [...section.pageRange] as [number, number],
  }));

  adjustedSections[adjustedSections.length - 1].pageRange[1] = targetPages;

  let cursor = 1;
  for (const section of adjustedSections) {
    const originalLength = Math.max(1, section.pageRange[1] - section.pageRange[0] + 1);
    const start = cursor;
    const end = Math.max(start, start + originalLength - 1);
    section.pageRange = [start, end];
    cursor = end + 1;
  }

  adjustedSections[adjustedSections.length - 1].pageRange[1] = targetPages;

  for (let i = adjustedSections.length - 2; i >= 0; i--) {
    const current = adjustedSections[i];
    const next = adjustedSections[i + 1];
    if (current.pageRange[1] >= next.pageRange[0]) {
      current.pageRange[1] = Math.max(current.pageRange[0], next.pageRange[0] - 1);
    }
  }

  return {
    ...storyline,
    totalPages: targetPages,
    sections: adjustedSections,
  };
}

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

  // 若用户未输入文字但上传了文档，从文档中提取摘要作为 userInput
  if (!input.userInput.trim() && docCount > 0) {
    const doc = input.documents![0];
    const headingsStr = doc.headings.length > 0 ? doc.headings.slice(0, 5).join("、") : "";
    const contentPreview = doc.content.slice(0, 200).replace(/\s+/g, " ").trim();
    input = {
      ...input,
      userInput: `根据上传的文档"${doc.filename}"生成 PPT 大纲。${headingsStr ? `文档要点：${headingsStr}。` : ""}${contentPreview}`,
    };
  }

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

  const structuredDocPageCount = getStructuredDocumentPageCount(input.documents);
  const hasStructuredDocs = (input.documents ?? []).some((doc) => doc.hasPageStructure);
  const resolvedScenarioType: "A" | "B" | "C" = input.scenarioType
    ?? (hasStructuredDocs ? "A" : intentResult.scenarioType);

  const effectivePageCount = input.pageCount
    ?? (resolvedScenarioType === "A" ? structuredDocPageCount ?? undefined : undefined);

  const resolvedIntentResult = {
    ...intentResult,
    scenarioType: resolvedScenarioType,
    pageCountSuggestion: effectivePageCount ?? intentResult.pageCountSuggestion,
  };

  onEvent({ type: "intent", data: resolvedIntentResult });

  if (resolvedScenarioType === "A" && structuredDocPageCount) {
    console.log(`[Orchestrator] 场景A：检测到结构化文档页数 ${structuredDocPageCount}，将优先按该页数生成`);
  }


  onEvent({ type: "status", step: "storyline", message: "正在构建故事线..." });

  let storylineResult;
  try {
    storylineResult = await withRetry(
      () => buildStoryline(input.userInput, resolvedIntentResult, config, effectivePageCount),
      1, "M3 故事线构建"
    );
  } catch (error) {
    onEvent({ type: "error", message: `故事线构建失败：${error instanceof Error ? error.message : "未知错误"}`, code: "LLM_ERROR" });
    throw error;
  }

  if (effectivePageCount && storylineResult.totalPages !== effectivePageCount) {
    console.warn(
      `[Orchestrator] M3 返回页数 ${storylineResult.totalPages} 与目标 ${effectivePageCount} 不一致，已强制修正`
    );
    storylineResult = enforceTotalPages(storylineResult, effectivePageCount);
  }

  onEvent({ type: "storyline", data: storylineResult });

  // ── M2 联网检索（场景B优先）────────────────────────────────────
  let researchResult;
  onEvent({ type: "status", step: "research", message: resolvedScenarioType === "B" ? "正在联网检索补充信息..." : "非场景B，跳过联网检索" });
  if (resolvedScenarioType === "B") {
    researchResult = await researchTopic(input.userInput, resolvedIntentResult);
    if (researchResult) {
      onEvent({ type: "research", data: researchResult });
    }
  }

  // ── M4 大纲生成（流式）──────────────────────────────────────
  onEvent({ type: "status", step: "outline", message: "正在生成详细大纲..." });

  let outline;
  try {
    // M4 不再 withRetry，因为流式输出中途失败重试意义不大
    outline = await generateDetailedOutline(
      input.userInput,
      resolvedIntentResult,
      storylineResult,
      config,
      (page, index) => {
        // 每解析出一页就立即推送
        onEvent({ type: "page", data: page, index });
      },
      input.documents,  // 将文档内容传给 M4，用于场景A/C的内容参考
      researchResult
    );
  } catch (error) {
    onEvent({ type: "error", message: `大纲生成失败：${error instanceof Error ? error.message : "未知错误"}`, code: "LLM_ERROR" });
    throw error;
  }

  // 流式完成后推送完整大纲（前端用于最终状态更新）
  onEvent({ type: "outline", data: outline });
  onEvent({ type: "done" });

  console.log("[Orchestrator] 全流程完成！");
  return outline;
}
