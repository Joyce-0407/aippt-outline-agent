/**
 * M2 联网检索模块（Phase 3）
 * 为场景B优先补充外部信息，产出可注入到后续 Prompt 的研究上下文
 */

import { LLMError } from "@/lib/llm-client";
import type { IntentAnalysis } from "@/types/intent";
import type { ResearchContext, ResearchSource } from "@/types/api";

interface TavilySearchResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
  }>;
}

function buildQueries(userInput: string, intent: IntentAnalysis): string[] {
  const topics = intent.topicKeywords.slice(0, 3).join(" ");
  return [
    `${userInput} 最新数据 趋势`,
    `${topics} ${intent.purpose} 关键案例`,
    `${topics} ${intent.audience} 最佳实践`,
  ];
}

function trimText(text: string, max = 180): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

async function searchWithTavily(query: string, apiKey: string): Promise<ResearchSource[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      max_results: 5,
      include_answer: false,
    }),
  });

  if (!response.ok) {
    throw new LLMError(`Tavily 请求失败: HTTP ${response.status}`, "API_ERROR");
  }

  const data = (await response.json()) as TavilySearchResponse;
  const results = data.results ?? [];

  return results
    .filter((item) => item.title && item.url && item.content)
    .map((item) => ({
      title: trimText(item.title ?? ""),
      url: item.url ?? "",
      snippet: trimText(item.content ?? "", 220),
    }))
    .filter((item) => item.title && item.url && item.snippet);
}

export async function researchTopic(
  userInput: string,
  intent: IntentAnalysis
): Promise<ResearchContext | undefined> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.log("[M2] 未配置 TAVILY_API_KEY，跳过联网检索");
    return undefined;
  }

  const queries = buildQueries(userInput, intent);

  try {
    const sourcesByQuery = await Promise.all(queries.map((q) => searchWithTavily(q, apiKey)));
    const dedupMap = new Map<string, ResearchSource>();

    for (const list of sourcesByQuery) {
      for (const source of list) {
        if (!dedupMap.has(source.url)) dedupMap.set(source.url, source);
      }
    }

    const sources = Array.from(dedupMap.values()).slice(0, 10);
    if (!sources.length) return undefined;

    const keyFindings = sources.slice(0, 5).map((s) => `${s.title}：${s.snippet}`);

    return {
      queries,
      keyFindings,
      sources,
    };
  } catch (error) {
    console.warn("[M2] 联网检索失败，降级继续：", error instanceof Error ? error.message : error);
    return undefined;
  }
}
