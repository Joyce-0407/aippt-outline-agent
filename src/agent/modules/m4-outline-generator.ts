/**
 * M4 大纲细化生成模块（流式版本）
 * 边接收 token，边解析完整的 Page 对象，边通过回调推送出去
 */

import { streamLLMContent, LLMError, type LLMClientConfig } from "@/lib/llm-client";
import { validateOutline } from "@/lib/validators";
import { SYSTEM_PROMPT } from "@/agent/prompts/system";
import { buildM4Prompt } from "@/agent/prompts/m4-outline";
import type { IntentAnalysis } from "@/types/intent";
import type { Storyline } from "@/types/storyline";
import type { PPTOutline, Page } from "@/types/outline";

/**
 * 从 JSON 缓冲区中提取所有已完整的 Page 对象
 * 使用括号深度计数 + 字符串感知，正确处理嵌套和转义
 */
function extractPagesFromBuffer(buffer: string): Page[] {
  // 找到 "pages": [ 的位置
  const pagesMatch = /"pages"\s*:\s*\[/.exec(buffer);
  if (!pagesMatch) return [];

  const afterBracket = buffer.slice(pagesMatch.index + pagesMatch[0].length);
  const pages: Page[] = [];
  let pos = 0;

  while (pos < afterBracket.length) {
    // 跳过空白和逗号
    while (pos < afterBracket.length && /[\s,]/.test(afterBracket[pos])) pos++;

    if (pos >= afterBracket.length) break;
    if (afterBracket[pos] === "]") break; // pages 数组结束
    if (afterBracket[pos] !== "{") break; // 意外字符

    // 用括号深度定位完整对象的结束位置
    const objStart = pos;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (let i = pos; i < afterBracket.length; i++) {
      const ch = afterBracket[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\" && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) { end = i; pos = i + 1; break; }
      }
    }

    if (end === -1) break; // 对象还没结束，等待更多 token

    try {
      const page = JSON.parse(afterBracket.slice(objStart, end + 1)) as Page;
      pages.push(page);
    } catch {
      break; // 解析失败，可能是不完整的 JSON，等下一批 token
    }
  }

  return pages;
}

/**
 * 流式生成详细大纲
 * @param onPage 每解析出一页时的回调，参数为页面数据和页面索引（0-based）
 * @returns 最终完整验证过的 PPTOutline
 */
export async function generateDetailedOutline(
  userInput: string,
  intent: IntentAnalysis,
  storyline: Storyline,
  config: LLMClientConfig,
  onPage: (page: Page, index: number) => void
): Promise<PPTOutline> {
  console.log(`[M4] 开始流式生成大纲，共 ${storyline.totalPages} 页...`);

  const userPrompt = buildM4Prompt(userInput, intent, storyline);

  let buffer = "";
  let emittedCount = 0;

  // 流式接收 token，逐步解析页面
  for await (const token of streamLLMContent(SYSTEM_PROMPT, userPrompt, config, {
    temperature: 0.7,
    maxTokens: 8192,
  })) {
    buffer += token;

    // 每次有新 token 就尝试提取更多完整页面
    const allPages = extractPagesFromBuffer(buffer);
    if (allPages.length > emittedCount) {
      const newPages = allPages.slice(emittedCount);
      for (const page of newPages) {
        onPage(page, emittedCount);
        emittedCount++;
        console.log(`[M4] 流式输出第 ${emittedCount} 页: "${page.title}"`);
      }
    }
  }

  console.log(`[M4] 流式完成，共输出 ${emittedCount} 页，开始校验完整结构...`);

  // 流结束后，对完整 buffer 做结构校验
  let parsed: unknown;
  try {
    parsed = JSON.parse(buffer);
  } catch {
    throw new LLMError("M4 返回内容不是有效 JSON", "PARSE_ERROR");
  }

  try {
    const outline = validateOutline(parsed);
    if (outline.pages.length !== storyline.totalPages) {
      console.warn(`[M4] 页数不一致: 生成 ${outline.pages.length} 页，期望 ${storyline.totalPages} 页`);
    }
    console.log(`[M4] 校验通过: "${outline.meta.title}", ${outline.pages.length} 页`);
    return outline;
  } catch (validationError) {
    throw new LLMError(
      validationError instanceof Error ? validationError.message : "M4 输出结构校验失败",
      "PARSE_ERROR"
    );
  }
}
