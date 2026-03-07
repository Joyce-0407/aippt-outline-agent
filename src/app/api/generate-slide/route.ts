/**
 * POST /api/generate-slide — 单页 HTML 幻灯片生成 / 重试接口
 *
 * 用途：
 * 1. 首次生成时可直接调用（通常由 M6 模块在 SSE 流中批量处理）
 * 2. 前端检测到爆版后，通过此接口传入 retryHint 进行重试
 *
 * 请求体：{ page, designSystem, llmConfig, retryHint? }
 * 响应：{ html: string }
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { generateSlideHTML } from "@/agent/modules/m6-slide-renderer";

/** 内容块类型枚举 */
const contentBlockTypeSchema = z.enum([
  "point",
  "quote",
  "data",
  "imageSuggestion",
  "chartSuggestion",
]);

/** 单个内容块 Schema */
const contentBlockSchema = z.object({
  type: contentBlockTypeSchema,
  title: z.string().optional(),
  detail: z.string(),
  supportingData: z.string().optional(),
});

/** 单页内容 Schema */
const pageContentSchema = z.object({
  headline: z.string(),
  subheadline: z.string().optional(),
  body: z.array(contentBlockSchema),
});

/** 单页设计建议 Schema */
const pageDesignSchema = z.object({
  layout: z.string(),
  visualElements: z.array(z.string()),
});

/** PPT 单页大纲 Schema */
const pageSchema = z.object({
  pageNumber: z.number().int().min(1),
  section: z.string(),
  title: z.string(),
  creativeIntent: z.string(),
  design: pageDesignSchema,
  content: pageContentSchema,
  speakerNotes: z.string().optional(),
  transitionToNext: z.string().optional(),
});

/** 全局视觉风格 Schema */
const designSystemSchema = z.object({
  styleTone: z.string(),
  palette: z.array(z.string()),
  typography: z.string(),
  visualStyle: z.string(),
});

/** 请求体 Schema */
const requestSchema = z.object({
  /** 单页大纲数据 */
  page: pageSchema,
  /** 全局视觉风格 */
  designSystem: designSystemSchema,
  /** LLM 配置 */
  llmConfig: z.object({
    apiKey: z.string().min(1, "API Key 不能为空"),
    baseUrl: z.string().url("Base URL 格式不正确"),
    model: z.string().min(1, "模型名称不能为空"),
  }),
  /**
   * 爆版重试提示（可选）
   * 前端检测到当前页内容溢出 1280×720 区域后，传入此字段触发重试
   * 后端会将此提示追加到 prompt 末尾，引导 LLM 精简内容
   */
  retryHint: z.string().optional(),
  /**
   * 总页数（可选，用于 prompt 中的页码上下文）
   * 告知 LLM "这是第 X 页 / 共 N 页"，帮助它判断封面/结尾的特殊处理
   */
  totalPages: z.number().int().min(1).optional(),
});

export async function POST(request: NextRequest): Promise<Response> {
  // 解析请求体
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "请求体必须是合法的 JSON 格式", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  // 参数校验
  const parseResult = requestSchema.safeParse(body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues
      .map((issue) => `"${issue.path.join(".")}" ${issue.message}`)
      .join("; ");
    return Response.json(
      { error: `请求参数不合法: ${errorMsg}`, code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  const { page, designSystem, llmConfig, retryHint, totalPages } =
    parseResult.data;

  // 构建 retryHint：若调用方未传入但接口收到的是重试请求，使用默认提示
  // 若调用方已传入自定义 retryHint，则直接使用
  const effectiveRetryHint = retryHint
    ? retryHint
    : undefined;

  // 爆版重试时追加的标准提示（当 retryHint 为空字符串或明确表示重试时）
  // 注意：任务说明要求 retryHint 不为空时追加特定文案
  const finalRetryHint =
    effectiveRetryHint !== undefined && effectiveRetryHint.trim().length > 0
      ? effectiveRetryHint +
        "\n\n上一次生成的页面内容超出了 1280x720 的区域。请务必精简内容，减少文字量，确保所有内容在区域内完整显示。"
      : undefined;

  try {
    const html = await generateSlideHTML(
      page,
      designSystem,
      {
        apiKey: llmConfig.apiKey,
        baseURL: llmConfig.baseUrl,
        model: llmConfig.model,
      },
      totalPages ?? page.pageNumber, // 若未传 totalPages，用当前页码作为占位
      finalRetryHint
    );

    return Response.json({ html });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败";
    console.error("[API /generate-slide] 生成失败:", message);
    return Response.json(
      { error: message, code: "LLM_ERROR" },
      { status: 500 }
    );
  }
}
