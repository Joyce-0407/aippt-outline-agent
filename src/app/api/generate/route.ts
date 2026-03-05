/**
 * POST /api/generate -- 大纲生成接口
 * 接收用户输入 + LLM 配置，返回 SSE 流式响应
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { generateOutline } from "@/agent/orchestrator";
import type { GenerateRequest, SSEEvent } from "@/types/api";

const generateRequestSchema = z.object({
  userInput: z.string().min(1, "userInput 不能为空").max(5000, "userInput 不能超过 5000 字符"),
  pageCount: z.number().int().min(5).max(30).optional(),
  purpose: z.string().optional(),
  audience: z.string().optional(),
  llmConfig: z.object({
    apiKey: z.string().min(1, "API Key 不能为空"),
    baseUrl: z.string().url("Base URL 格式不正确"),
    model: z.string().min(1, "模型名称不能为空"),
  }),
});

function formatSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "请求体必须是合法的 JSON 格式", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  const parseResult = generateRequestSchema.safeParse(body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues
      .map((issue) => `"${issue.path.join(".")}" ${issue.message}`)
      .join("; ");
    return Response.json(
      { error: `请求参数不合法: ${errorMsg}`, code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  const input: GenerateRequest = parseResult.data;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendEvent = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(formatSSE(event)));
      };

      try {
        await generateOutline(input, sendEvent);
      } catch (error) {
        console.error("[API] 生成过程中发生错误:", error instanceof Error ? error.message : error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
