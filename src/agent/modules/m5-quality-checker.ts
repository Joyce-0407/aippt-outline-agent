/**
 * M5 质量审查模块
 * 在 M4 大纲生成后，对完整大纲进行质量审查
 * 发现 high 级别问题时自动替换修正后的页面
 */

import { callLLM, type LLMClientConfig } from "@/lib/llm-client";
import { SYSTEM_PROMPT } from "@/agent/prompts/system";
import { buildM5Prompt } from "@/agent/prompts/m5-quality";
import type { IntentAnalysis } from "@/types/intent";
import type { PPTOutline, Page } from "@/types/outline";

/** 审查问题 */
export interface QualityIssue {
  severity: "high" | "medium" | "low";
  pageNumber?: number;
  dimension: string;
  description: string;
  suggestion: string;
}

/** M5 审查结果 */
export interface QualityReviewResult {
  overallScore: number;
  dimensionScores: {
    intentAlignment: number;
    logicalCoherence: number;
    contentCompleteness: number;
    informationDensity: number;
    audienceMatch: number;
    practicality: number;
  };
  summary: string;
  issues: QualityIssue[];
  strengths: string[];
  refinedPages: Page[];
}

/**
 * 对大纲进行质量审查
 * @returns 审查结果 + 应用修正后的大纲
 */
export async function reviewOutlineQuality(
  userInput: string,
  intent: IntentAnalysis,
  outline: PPTOutline,
  config: LLMClientConfig
): Promise<{ review: QualityReviewResult; refinedOutline: PPTOutline }> {
  console.log(`[M5] 开始质量审查，共 ${outline.pages.length} 页...`);

  const userPrompt = buildM5Prompt(userInput, intent, outline);

  const review = await callLLM<QualityReviewResult>(
    SYSTEM_PROMPT,
    userPrompt,
    config,
    { temperature: 0.3, maxTokens: 4096 }
  );

  console.log(`[M5] 审查完成: 综合评分 ${review.overallScore}, ${review.issues.length} 个问题`);

  // 如果有 refinedPages，替换对应页面
  let refinedOutline = outline;
  if (review.refinedPages && review.refinedPages.length > 0) {
    const refinedMap = new Map<number, Page>();
    for (const page of review.refinedPages) {
      if (page.pageNumber) {
        refinedMap.set(page.pageNumber, page);
      }
    }

    if (refinedMap.size > 0) {
      const newPages = outline.pages.map((p) => refinedMap.get(p.pageNumber) ?? p);
      refinedOutline = { ...outline, pages: newPages };
      console.log(`[M5] 已替换 ${refinedMap.size} 个页面`);
    }
  }

  return { review, refinedOutline };
}
