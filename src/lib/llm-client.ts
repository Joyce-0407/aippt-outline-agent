/**
 * LLM 客户端封装
 * 支持动态传入 apiKey / baseURL / model
 * 提供普通调用（callLLM）和流式 token 输出（streamLLMContent）两种模式
 */

import OpenAI from "openai";

export interface LLMClientConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export interface LLMCallOptions {
  temperature?: number;
  maxTokens?: number;
  /** 覆盖 config 中的 model */
  model?: string;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: "NETWORK_ERROR" | "API_ERROR" | "PARSE_ERROR"
  ) {
    super(message);
    this.name = "LLMError";
  }
}

function createClient(config: LLMClientConfig): OpenAI {
  return new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
}

/**
 * 普通调用：等待完整 JSON 响应后返回（用于 M1、M3）
 */
export async function callLLM<T>(
  systemPrompt: string,
  userPrompt: string,
  config: LLMClientConfig,
  options?: LLMCallOptions
): Promise<T> {
  const model = options?.model ?? config.model;
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 4096;

  console.log(`[LLMClient] callLLM 模型: ${model}`);

  const client = createClient(config);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    });

    const usage = response.usage;
    if (usage) {
      console.log(`[LLMClient] Token: 输入 ${usage.prompt_tokens}, 输出 ${usage.completion_tokens}`);
    }

    const content = response.choices[0]?.message?.content;
    if (!content) throw new LLMError("LLM 返回内容为空", "API_ERROR");

    try {
      return JSON.parse(content) as T;
    } catch {
      throw new LLMError(`返回内容不是有效 JSON: ${content.substring(0, 100)}`, "PARSE_ERROR");
    }
  } catch (error) {
    if (error instanceof LLMError) throw error;
    if (error instanceof OpenAI.APIError) {
      throw new LLMError(`API 调用失败: ${error.message}`, "API_ERROR");
    }
    throw new LLMError(`网络请求失败: ${error instanceof Error ? error.message : "未知错误"}`, "NETWORK_ERROR");
  }
}

/**
 * 流式调用：边生成边 yield token（用于 M4 大纲流式输出）
 */
export async function* streamLLMContent(
  systemPrompt: string,
  userPrompt: string,
  config: LLMClientConfig,
  options?: LLMCallOptions
): AsyncGenerator<string> {
  const model = options?.model ?? config.model;
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 8192;

  console.log(`[LLMClient] streamLLMContent 模型: ${model}`);

  const client = createClient(config);

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      stream: true,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? "";
      if (token) yield token;
    }
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new LLMError(`API 调用失败: ${error.message}`, "API_ERROR");
    }
    throw new LLMError(`网络请求失败: ${error instanceof Error ? error.message : "未知错误"}`, "NETWORK_ERROR");
  }
}
