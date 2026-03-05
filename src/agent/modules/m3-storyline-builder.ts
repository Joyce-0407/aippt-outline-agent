/**
 * M3 故事线构建模块
 */

import { callLLM, LLMError, type LLMClientConfig } from "@/lib/llm-client";
import { validateStoryline } from "@/lib/validators";
import { SYSTEM_PROMPT } from "@/agent/prompts/system";
import { buildM3Prompt } from "@/agent/prompts/m3-storyline";
import type { IntentAnalysis } from "@/types/intent";
import type { Storyline } from "@/types/storyline";

export async function buildStoryline(
  userInput: string,
  intent: IntentAnalysis,
  config: LLMClientConfig,
  pageCount?: number
): Promise<Storyline> {
  const targetPages = pageCount ?? intent.pageCountSuggestion;
  console.log(`[M3] 开始构建故事线，目标页数: ${targetPages}...`);

  const userPrompt = buildM3Prompt(userInput, intent, pageCount);

  const rawResult = await callLLM<unknown>(SYSTEM_PROMPT, userPrompt, config, {
    temperature: 0.8,
    maxTokens: 2048,
  });

  let storyline: Storyline;
  try {
    storyline = validateStoryline(rawResult);
  } catch (validationError) {
    console.error("[M3] 校验失败，原始输出:", JSON.stringify(rawResult));
    throw new LLMError(
      validationError instanceof Error ? validationError.message : "M3 输出结构校验失败",
      "PARSE_ERROR"
    );
  }

  validateSectionPageRanges(storyline, targetPages);

  console.log(`[M3] 完成: 框架="${storyline.narrativeFramework}", 共${storyline.sections.length}个章节`);
  return storyline;
}

function validateSectionPageRanges(storyline: Storyline, targetPages: number): void {
  const { sections, totalPages } = storyline;
  if (totalPages !== targetPages) {
    console.warn(`[M3] 警告：totalPages=${totalPages} 与目标 ${targetPages} 不一致`);
  }
  let lastEndPage = 0;
  for (const section of sections) {
    const [startPage, endPage] = section.pageRange;
    if (startPage !== lastEndPage + 1) {
      console.warn(`[M3] 警告：章节 "${section.title}" 页码不连续`);
    }
    lastEndPage = endPage;
  }
}
