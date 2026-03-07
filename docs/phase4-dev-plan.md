# Phase 4 HTML 幻灯片生成 -- 详细开发方案

> 版本：v1.0 | 日期：2026-03-07
> 基于 `docs/phase4-html-slides.md` 产品方案，拆解为可直接编码的开发指令

---

## 一、文件变更清单

### 1.1 新增文件（8 个）

| 文件路径 | 职责 |
|---------|------|
| `src/agent/modules/m5-slide-renderer.ts` | M5 模块：并发调用 LLM 生成每页 HTML，信号量控制 |
| `src/agent/prompts/m5-slide.ts` | M5 prompt 模板：单页 HTML 生成 prompt + 重试 prompt |
| `src/app/api/generate-slide/route.ts` | 单页重试 API：前端爆版检测后调用此接口重新生成 |
| `src/components/SlidePreview.tsx` | 幻灯片预览主组件：单页查看 + 翻页 + 缩略图导航 |
| `src/components/SlideIframe.tsx` | iframe 渲染组件：封装 srcDoc + 缩放逻辑 |
| `src/components/SlideThumbnailStrip.tsx` | 底部缩略图导航条 |
| `src/lib/overflow-detector.ts` | 爆版检测工具：隐藏 iframe 检测 scrollHeight |
| `src/hooks/useSlideGeneration.ts` | 幻灯片生成状态管理 hook：SSE 事件消费 + 爆版重试 |

### 1.2 修改文件（5 个）

| 文件路径 | 变更内容 |
|---------|---------|
| `src/types/api.ts` | 新增 SSE 事件类型 `slides_start` / `slide_html` / `slide_error`；SSEStep 新增 `"slides"` |
| `src/agent/orchestrator.ts` | M4 完成后调用 M5，推送新 SSE 事件 |
| `src/app/page.tsx` | 新增 slides 状态管理、Tab 切换逻辑、SSE 新事件处理 |
| `src/components/ProgressIndicator.tsx` | ProgressState 新增 `slides` 步骤 |
| `src/components/OutlineDisplay.tsx` | 微调（无功能变更，只是确保 Tab 切换时正常卸载/挂载） |

---

## 二、类型定义变更

### 2.1 `src/types/api.ts` 变更

```typescript
// ====== 变更 1：SSEStep 新增 "slides" ======
export type SSEStep = "parse" | "intent" | "storyline" | "research" | "outline" | "slides";

// ====== 变更 2：SSEEvent 联合体新增 3 个事件 ======
export type SSEEvent =
  | { /* ...现有 8 种事件保持不变... */ }

  // ── M5 HTML 幻灯片生成相关事件 ──
  | {
      /** M5 进入 HTML 生成阶段，通知前端总页数 */
      type: "slides_start";
      totalPages: number;
    }
  | {
      /** 单页 HTML 生成完成 */
      type: "slide_html";
      pageIndex: number;     // 0-based 索引
      html: string;          // 完整 HTML 字符串
    }
  | {
      /** 单页生成失败（后端重试耗尽） */
      type: "slide_error";
      pageIndex: number;
      message: string;
    };
```

### 2.2 新增前端状态类型（定义在 `src/hooks/useSlideGeneration.ts` 中）

```typescript
/** 单页幻灯片的前端状态 */
export type SlideStatus = "pending" | "generating" | "done" | "retrying" | "failed";

export interface SlideState {
  pageIndex: number;
  status: SlideStatus;
  html: string | null;      // 生成成功的 HTML
  retryCount: number;        // 前端爆版重试次数
  hasOverflow: boolean;      // 是否被检测为爆版
  isDowngraded: boolean;     // 是否经过降级处理
}

/** Tab 视图模式 */
export type ViewMode = "outline" | "preview";
```

---

## 三、后端模块设计

### 3.1 M5 Prompt 模板 — `src/agent/prompts/m5-slide.ts`

```typescript
import type { Page, GlobalDesignSystem } from "@/types/outline";

/**
 * 构建单页 HTML 生成的 prompt
 * 复用 test-slide/route.ts 已验证的 prompt 结构，增强防爆版约束
 */
export function buildSlidePrompt(
  page: Page,
  designSystem: GlobalDesignSystem,
  context: {
    totalPages: number;
    prevPageTitle?: string;   // 上一页标题（视觉风格衔接）
    nextPageTitle?: string;   // 下一页标题
  }
): string {
  // ...见下文完整实现
}

/**
 * 构建爆版重试时的追加约束
 */
export function buildRetryConstraint(): string {
  // ...见下文完整实现
}
```

**完整实现：**

```typescript
import type { Page, GlobalDesignSystem } from "@/types/outline";

export function buildSlidePrompt(
  page: Page,
  designSystem: GlobalDesignSystem,
  context: {
    totalPages: number;
    prevPageTitle?: string;
    nextPageTitle?: string;
  }
): string {
  const contentBlocks = page.content.body
    .map(
      (b, i) =>
        `  ${i + 1}. [${b.type}] ${b.title ? b.title + "：" : ""}${b.detail}${
          b.supportingData ? `（数据：${b.supportingData}）` : ""
        }`
    )
    .join("\n");

  const pageContext = [
    `- 页码：第 ${page.pageNumber} 页 / 共 ${context.totalPages} 页`,
    context.prevPageTitle ? `- 上一页：${context.prevPageTitle}` : null,
    context.nextPageTitle ? `- 下一页：${context.nextPageTitle}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `你是一位顶尖的 PPT 视觉设计师，擅长用 HTML + CSS 制作精美的演示文稿页面。

## 任务
根据以下 PPT 页面的内容和设计建议，生成一个完整的、可独立运行的 HTML 页面。

## 全局设计系统
- 风格基调：${designSystem.styleTone}
- 主色板：${designSystem.palette.join("、")}
- 字体风格：${designSystem.typography}
- 视觉风格：${designSystem.visualStyle}

## 页面上下文
${pageContext}

## 本页信息
- 所属章节：${page.section}
- 页面标题：${page.title}
- 创作思路：${page.creativeIntent}

## 设计建议
- 布局类型：${page.design.layout}
- 视觉元素：${page.design.visualElements.join("；")}

## 页面内容
- 主标题：${page.content.headline}
${page.content.subheadline ? `- 副标题：${page.content.subheadline}` : ""}
- 内容块：
${contentBlocks}

## 关键约束（必须严格遵守）

1. 页面总尺寸固定为 1280x720px
2. html 和 body 设置：width:1280px; height:720px; overflow:hidden; margin:0; padding:0; box-sizing:border-box; position:relative
3. 所有内容必须在 1280x720 区域内完整展示，不允许任何内容超出
4. 内容区域建议使用 padding: 60px 80px，确保内容不贴边
5. 文字行数限制：标题最多 2 行，正文每个要点最多 3 行
6. 使用 CSS 的 overflow:hidden 和 text-overflow:ellipsis 防止溢出
7. 不要使用 position:absolute 将元素放到可视区域外
8. 内容块超过 4 个时，减小字号或简化排版
9. 所有容器必须设置 overflow:hidden

## 视觉要求

1. 输出完整 HTML（包含 <!DOCTYPE html>、<html>、<head>、<body>）
2. 所有样式用内联 <style> 标签写在 <head> 中，不引用外部 CSS
3. 可以使用 Google Fonts（通过 @import）
4. 颜色方案严格遵循主色板
5. 布局精确匹配设计建议中的布局类型
6. imageSuggestion 类型：用精美的占位区域（渐变背景 + SVG 图标 + 描述文字）
7. chartSuggestion 类型：用 SVG 绘制示意性图表
8. data 类型：用醒目的大字号突出数据
9. 要有专业的视觉层次感：标题 > 副标题 > 正文，留白合理
10. 可适当添加装饰性元素（渐变色块、线条、圆形）提升视觉品质
11. 不要使用 JavaScript
12. 第一页（封面页）和最后一页（结尾页）要有特殊的视觉处理

## 输出格式
直接输出 HTML 代码，不要用 markdown 代码块包裹，不要有任何额外说明文字。第一个字符必须是 <`;
}

export function buildRetryConstraint(): string {
  return `

## 重要修正（本次为重试生成）

上一次生成的 HTML 内容超出了 1280x720 区域，发生了"爆版"。请特别注意：
- 大幅减少内容量，优先保证核心信息，次要信息直接省略
- 减小字号：标题不超过 32px，正文不超过 14px
- 增加 padding 到 70px 90px，确保四周留白充足
- 内容块如果超过 3 个，只保留最重要的 3 个
- 所有容器必须设置 overflow:hidden
- body 必须设置 height:720px; overflow:hidden
- 宁可内容少一点，也绝不能超出 720px 高度`;
}
```

### 3.2 M5 模块 — `src/agent/modules/m5-slide-renderer.ts`

```typescript
/**
 * M5 HTML 幻灯片渲染模块
 * 职责：接收完整大纲，为每页并发生成 HTML
 */

import type { PPTOutline, Page, GlobalDesignSystem } from "@/types/outline";
import type { LLMClientConfig } from "@/lib/llm-client";
import { buildSlidePrompt, buildRetryConstraint } from "@/agent/prompts/m5-slide";
import OpenAI from "openai";

// ── 类型定义 ──

export interface SlideRenderCallbacks {
  onSlideReady: (pageIndex: number, html: string) => void;
  onSlideError: (pageIndex: number, error: string) => void;
}

// ── 信号量实现 ──

class Semaphore {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(private readonly max: number) {}

  async acquire<T>(fn: () => Promise<T>): Promise<T> {
    // 等待获取许可
    if (this.running >= this.max) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

// ── 核心函数 ──

const MAX_CONCURRENCY = 3;
const MAX_API_RETRIES = 1;    // API 级别重试（网络错误等），不是爆版重试
const RETRY_DELAY_MS = 2000;

/**
 * 为整份大纲的所有页面并发生成 HTML
 * 通过 callbacks 逐页推送结果
 */
export async function renderSlidesToHtml(
  outline: PPTOutline,
  config: LLMClientConfig,
  callbacks: SlideRenderCallbacks
): Promise<void> {
  const { pages, meta } = outline;
  const semaphore = new Semaphore(MAX_CONCURRENCY);

  console.log(`[M5] 开始生成 ${pages.length} 页 HTML，并发数: ${MAX_CONCURRENCY}`);

  const tasks = pages.map((page, index) =>
    semaphore.acquire(async () => {
      const startTime = Date.now();
      try {
        const html = await generateSingleSlideWithRetry(
          page,
          meta.designSystem,
          config,
          {
            totalPages: meta.totalPages,
            prevPageTitle: index > 0 ? pages[index - 1].title : undefined,
            nextPageTitle: index < pages.length - 1 ? pages[index + 1].title : undefined,
          },
          false // isRetry = false（首次生成）
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[M5] 第 ${index + 1} 页 HTML 生成完成 (${elapsed}s)`);
        callbacks.onSlideReady(index, html);
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误";
        console.error(`[M5] 第 ${index + 1} 页 HTML 生成失败: ${message}`);
        callbacks.onSlideError(index, message);
      }
    })
  );

  await Promise.allSettled(tasks);
  console.log(`[M5] 全部 ${pages.length} 页 HTML 生成任务完成`);
}

/**
 * 生成单页 HTML（带 API 级别重试）
 * 此函数也被 /api/generate-slide 复用
 */
export async function renderSingleSlide(
  page: Page,
  designSystem: GlobalDesignSystem,
  config: LLMClientConfig,
  context: {
    totalPages: number;
    prevPageTitle?: string;
    nextPageTitle?: string;
  },
  isRetry: boolean = false
): Promise<string> {
  const prompt = buildSlidePrompt(page, designSystem, context)
    + (isRetry ? buildRetryConstraint() : "");

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 8192,
  });

  let html = response.choices[0]?.message?.content ?? "";

  // 清理可能的 markdown 包裹
  html = html.trim();
  if (html.startsWith("```html")) html = html.slice(7);
  if (html.startsWith("```")) html = html.slice(3);
  if (html.endsWith("```")) html = html.slice(0, -3);
  html = html.trim();

  if (!html || !html.startsWith("<")) {
    throw new Error("LLM 返回的内容不是合法 HTML");
  }

  return html;
}

/**
 * 内部使用：带 API 级别重试的单页生成
 */
async function generateSingleSlideWithRetry(
  page: Page,
  designSystem: GlobalDesignSystem,
  config: LLMClientConfig,
  context: {
    totalPages: number;
    prevPageTitle?: string;
    nextPageTitle?: string;
  },
  isRetry: boolean
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt++) {
    try {
      return await renderSingleSlide(page, designSystem, config, context, isRetry);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("未知错误");
      if (attempt < MAX_API_RETRIES) {
        console.warn(`[M5] 第 ${page.pageNumber} 页 API 调用失败，${RETRY_DELAY_MS}ms 后重试...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  throw lastError ?? new Error("生成失败");
}
```

### 3.3 Orchestrator 集成 — `src/agent/orchestrator.ts` 变更

在 `generateOutline` 函数末尾，替换现有的 done 事件推送：

```typescript
// ── 修改前（删除这 2 行）──
// onEvent({ type: "outline", data: outline });
// onEvent({ type: "done" });

// ── 修改后 ──
import { renderSlidesToHtml } from "@/agent/modules/m5-slide-renderer";

// ... 在 generateOutline 末尾：

// 流式完成后推送完整大纲
onEvent({ type: "outline", data: outline });

// ── M5 HTML 幻灯片生成 ──
onEvent({ type: "status", step: "slides", message: "正在生成 PPT 预览..." });
onEvent({ type: "slides_start", totalPages: outline.pages.length });

try {
  await renderSlidesToHtml(outline, config, {
    onSlideReady: (pageIndex, html) => {
      onEvent({ type: "slide_html", pageIndex, html });
    },
    onSlideError: (pageIndex, error) => {
      onEvent({ type: "slide_error", pageIndex, message: error });
    },
  });
} catch (error) {
  console.error("[Orchestrator] M5 HTML 生成出错:", error);
  // M5 整体失败不阻塞，已完成的页面仍然可用
}

onEvent({ type: "done" });
console.log("[Orchestrator] 全流程完成！");
return outline;
```

### 3.4 单页重试 API — `src/app/api/generate-slide/route.ts`

```typescript
/**
 * POST /api/generate-slide — 单页 HTML 生成/重试 API
 * 用途：前端爆版检测后调用此接口重新生成
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { renderSingleSlide } from "@/agent/modules/m5-slide-renderer";
import type { Page, GlobalDesignSystem } from "@/types/outline";

const requestSchema = z.object({
  page: z.object({
    pageNumber: z.number(),
    section: z.string(),
    title: z.string(),
    creativeIntent: z.string(),
    design: z.object({
      layout: z.string(),
      visualElements: z.array(z.string()),
    }),
    content: z.object({
      headline: z.string(),
      subheadline: z.string().optional(),
      body: z.array(z.object({
        type: z.string(),
        title: z.string().optional(),
        detail: z.string(),
        supportingData: z.string().optional(),
      })),
    }),
    speakerNotes: z.string().optional(),
    transitionToNext: z.string().optional(),
  }),
  designSystem: z.object({
    styleTone: z.string(),
    palette: z.array(z.string()),
    typography: z.string(),
    visualStyle: z.string(),
  }),
  totalPages: z.number().int().min(1),
  prevPageTitle: z.string().optional(),
  nextPageTitle: z.string().optional(),
  isRetry: z.boolean().default(false),
  llmConfig: z.object({
    apiKey: z.string().min(1),
    baseUrl: z.string().url(),
    model: z.string().min(1),
  }),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "请求体必须是合法的 JSON 格式" },
      { status: 400 }
    );
  }

  const parseResult = requestSchema.safeParse(body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues
      .map((issue) => `"${issue.path.join(".")}" ${issue.message}`)
      .join("; ");
    return Response.json(
      { error: `参数不合法: ${errorMsg}` },
      { status: 400 }
    );
  }

  const { page, designSystem, totalPages, prevPageTitle, nextPageTitle, isRetry, llmConfig } =
    parseResult.data;

  try {
    const html = await renderSingleSlide(
      page as Page,
      designSystem as GlobalDesignSystem,
      {
        apiKey: llmConfig.apiKey,
        baseURL: llmConfig.baseUrl,  // 注意：前端传 baseUrl，LLMClientConfig 用 baseURL
        model: llmConfig.model,
      },
      { totalPages, prevPageTitle, nextPageTitle },
      isRetry
    );

    return Response.json({ html });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "生成失败" },
      { status: 500 }
    );
  }
}
```

---

## 四、前端组件设计

### 4.1 爆版检测工具 — `src/lib/overflow-detector.ts`

```typescript
/**
 * 前端爆版检测工具
 * 在隐藏的 iframe 中渲染 HTML，检测内容是否超出 720px 高度
 */

const OVERFLOW_THRESHOLD = 725; // 720 + 5px 容差
const DETECT_TIMEOUT_MS = 2000;  // 超时保护

/**
 * 检测 HTML 内容是否爆版（内容溢出 720px 高度）
 * @returns true 表示爆版
 */
export async function detectOverflow(html: string): Promise<boolean> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1280px;height:720px;border:none;visibility:hidden;pointer-events:none";
    document.body.appendChild(iframe);

    let resolved = false;
    const cleanup = () => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    };
    const finish = (result: boolean) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    };

    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) {
          finish(false);
          return;
        }
        const body = doc.body;
        const isOverflow = body.scrollHeight > OVERFLOW_THRESHOLD;
        finish(isOverflow);
      } catch {
        finish(false); // 跨域等异常时假设不爆版
      }
    };

    iframe.srcdoc = html;

    // 超时保护
    setTimeout(() => finish(false), DETECT_TIMEOUT_MS);
  });
}

/**
 * 在 HTML 中注入强制 overflow:hidden 样式（降级处理）
 */
export function injectOverflowFix(html: string): string {
  const fixCSS =
    "<style>html,body{width:1280px!important;height:720px!important;overflow:hidden!important;}</style>";

  // 优先插入到 </head> 前
  if (html.includes("</head>")) {
    return html.replace("</head>", fixCSS + "</head>");
  }

  // 没有 </head> 标签时，插入到最前面
  return fixCSS + html;
}
```

### 4.2 幻灯片生成状态管理 Hook — `src/hooks/useSlideGeneration.ts`

```typescript
"use client";

/**
 * 幻灯片生成状态管理 Hook
 * 管理：SSE 事件消费、各页状态、爆版检测、重试调度
 */

import { useState, useCallback, useRef } from "react";
import { detectOverflow, injectOverflowFix } from "@/lib/overflow-detector";
import type { LLMConfig } from "@/types/api";
import type { PPTOutline, Page, GlobalDesignSystem } from "@/types/outline";

// ── 类型定义 ──

export type SlideStatus = "pending" | "generating" | "done" | "retrying" | "failed";

export interface SlideState {
  pageIndex: number;
  status: SlideStatus;
  html: string | null;
  retryCount: number;
  hasOverflow: boolean;
  isDowngraded: boolean;
}

export type ViewMode = "outline" | "preview";

const MAX_FRONTEND_RETRIES = 2;

// ── Hook 定义 ──

export function useSlideGeneration() {
  const [slides, setSlides] = useState<SlideState[]>([]);
  const [slidesTotal, setSlidesTotal] = useState(0);
  const [slidesPhaseActive, setSlidesPhaseActive] = useState(false);
  const [allSlidesComplete, setAllSlidesComplete] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("outline");
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // 用 ref 存储重试所需的上下文（避免闭包捕获旧值）
  const outlineRef = useRef<PPTOutline | null>(null);
  const llmConfigRef = useRef<LLMConfig | null>(null);

  /** 重置所有 slide 状态 */
  const resetSlides = useCallback(() => {
    setSlides([]);
    setSlidesTotal(0);
    setSlidesPhaseActive(false);
    setAllSlidesComplete(false);
    setViewMode("outline");
    setCurrentSlideIndex(0);
    outlineRef.current = null;
  }, []);

  /** 设置上下文（在收到 outline 事件时调用） */
  const setContext = useCallback((outline: PPTOutline, llmConfig: LLMConfig) => {
    outlineRef.current = outline;
    llmConfigRef.current = llmConfig;
  }, []);

  /** 处理 slides_start 事件 */
  const handleSlidesStart = useCallback((totalPages: number) => {
    setSlidesTotal(totalPages);
    setSlidesPhaseActive(true);
    // 初始化所有页面为 pending
    setSlides(
      Array.from({ length: totalPages }, (_, i) => ({
        pageIndex: i,
        status: "pending" as const,
        html: null,
        retryCount: 0,
        hasOverflow: false,
        isDowngraded: false,
      }))
    );
  }, []);

  /** 处理 slide_html 事件：先展示，后台检测爆版 */
  const handleSlideHtml = useCallback(async (pageIndex: number, html: string) => {
    // 1. 立即展示给用户
    setSlides((prev) =>
      prev.map((s) =>
        s.pageIndex === pageIndex
          ? { ...s, status: "done", html, hasOverflow: false }
          : s
      )
    );

    // 2. 后台检测爆版
    const isOverflow = await detectOverflow(html);
    if (!isOverflow) return; // 没有爆版，完成

    // 3. 需要重试
    await retrySlide(pageIndex, html);
  }, []); // retrySlide 在下面定义，通过 ref 访问状态

  /** 爆版重试逻辑 */
  const retrySlide = useCallback(async (pageIndex: number, currentHtml: string) => {
    const outline = outlineRef.current;
    const llmConfig = llmConfigRef.current;
    if (!outline || !llmConfig) return;

    // 获取当前重试次数
    let currentRetryCount = 0;
    setSlides((prev) => {
      const slide = prev.find((s) => s.pageIndex === pageIndex);
      currentRetryCount = slide?.retryCount ?? 0;
      return prev;
    });

    if (currentRetryCount >= MAX_FRONTEND_RETRIES) {
      // 重试次数用尽，降级处理
      const fixedHtml = injectOverflowFix(currentHtml);
      setSlides((prev) =>
        prev.map((s) =>
          s.pageIndex === pageIndex
            ? { ...s, status: "done", html: fixedHtml, hasOverflow: true, isDowngraded: true }
            : s
        )
      );
      return;
    }

    // 标记为重试中
    setSlides((prev) =>
      prev.map((s) =>
        s.pageIndex === pageIndex
          ? { ...s, status: "retrying", retryCount: s.retryCount + 1 }
          : s
      )
    );

    try {
      const page = outline.pages[pageIndex];
      const response = await fetch("/api/generate-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page,
          designSystem: outline.meta.designSystem,
          totalPages: outline.meta.totalPages,
          prevPageTitle: pageIndex > 0 ? outline.pages[pageIndex - 1].title : undefined,
          nextPageTitle:
            pageIndex < outline.pages.length - 1
              ? outline.pages[pageIndex + 1].title
              : undefined,
          isRetry: true,
          llmConfig,
        }),
      });

      if (!response.ok) {
        throw new Error(`重试请求失败: HTTP ${response.status}`);
      }

      const { html: newHtml } = await response.json();

      // 再次检测
      const stillOverflow = await detectOverflow(newHtml);
      if (!stillOverflow) {
        // 重试成功
        setSlides((prev) =>
          prev.map((s) =>
            s.pageIndex === pageIndex
              ? { ...s, status: "done", html: newHtml, hasOverflow: false }
              : s
          )
        );
      } else {
        // 仍然爆版，递归重试或降级
        await retrySlide(pageIndex, newHtml);
      }
    } catch (error) {
      console.error(`[SlideRetry] 第 ${pageIndex + 1} 页重试失败:`, error);
      // 重试失败，降级处理
      const fixedHtml = injectOverflowFix(currentHtml);
      setSlides((prev) =>
        prev.map((s) =>
          s.pageIndex === pageIndex
            ? { ...s, status: "done", html: fixedHtml, hasOverflow: true, isDowngraded: true }
            : s
        )
      );
    }
  }, []);

  /** 处理 slide_error 事件 */
  const handleSlideError = useCallback((pageIndex: number, message: string) => {
    setSlides((prev) =>
      prev.map((s) =>
        s.pageIndex === pageIndex
          ? { ...s, status: "failed", html: null }
          : s
      )
    );
  }, []);

  /** 检查是否所有 slides 都已完成（done 或 failed） */
  const checkAllComplete = useCallback(() => {
    setSlides((prev) => {
      const allDone = prev.length > 0 && prev.every(
        (s) => s.status === "done" || s.status === "failed"
      );
      if (allDone) {
        setAllSlidesComplete(true);
        setViewMode("preview"); // 自动切换到预览视图
        setCurrentSlideIndex(0);
      }
      return prev;
    });
  }, []);

  /** 翻页控制 */
  const goToSlide = useCallback((index: number) => {
    setCurrentSlideIndex((prev) =>
      Math.max(0, Math.min(index, slidesTotal - 1))
    );
  }, [slidesTotal]);

  const goNext = useCallback(() => {
    setCurrentSlideIndex((prev) => Math.min(prev + 1, slidesTotal - 1));
  }, [slidesTotal]);

  const goPrev = useCallback(() => {
    setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  return {
    // 状态
    slides,
    slidesTotal,
    slidesPhaseActive,
    allSlidesComplete,
    viewMode,
    currentSlideIndex,
    // 事件处理
    handleSlidesStart,
    handleSlideHtml,
    handleSlideError,
    checkAllComplete,
    resetSlides,
    setContext,
    // 交互
    setViewMode,
    goToSlide,
    goNext,
    goPrev,
  };
}
```

### 4.3 iframe 渲染组件 — `src/components/SlideIframe.tsx`

```typescript
"use client";

/**
 * 幻灯片 iframe 渲染组件
 * 在 iframe 中以 srcDoc 方式渲染 HTML，支持缩放
 */

import { useRef, useState, useEffect, useCallback } from "react";

interface SlideIframeProps {
  html: string;
  /** 容器自适应缩放（默认 true） */
  autoScale?: boolean;
  /** 固定缩放比例（设置此项时 autoScale 无效） */
  fixedScale?: number;
  /** 额外的 className */
  className?: string;
  /** 是否禁止交互（缩略图用） */
  inert?: boolean;
}

const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;

export default function SlideIframe({
  html,
  autoScale = true,
  fixedScale,
  className = "",
  inert = false,
}: SlideIframeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(fixedScale ?? 1);

  // 自适应缩放：监听容器宽度变化
  useEffect(() => {
    if (fixedScale !== undefined || !autoScale) {
      if (fixedScale !== undefined) setScale(fixedScale);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width;
        const newScale = containerWidth / SLIDE_WIDTH;
        setScale(newScale);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [autoScale, fixedScale]);

  const scaledHeight = SLIDE_HEIGHT * scale;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ height: scaledHeight }}
    >
      <iframe
        srcDoc={html}
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          border: "none",
        }}
        sandbox="allow-same-origin"
        title="Slide"
        tabIndex={inert ? -1 : undefined}
        // pointer-events 在缩略图模式下禁止
        className={inert ? "pointer-events-none" : ""}
      />
    </div>
  );
}
```

### 4.4 幻灯片预览主组件 — `src/components/SlidePreview.tsx`

```typescript
"use client";

/**
 * 幻灯片预览主组件
 * 功能：单页查看 + 左右翻页 + 键盘快捷键 + 底部缩略图导航
 */

import { useEffect, useCallback } from "react";
import SlideIframe from "./SlideIframe";
import SlideThumbnailStrip from "./SlideThumbnailStrip";
import type { SlideState } from "@/hooks/useSlideGeneration";

interface SlidePreviewProps {
  slides: SlideState[];
  currentIndex: number;
  onGoToSlide: (index: number) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function SlidePreview({
  slides,
  currentIndex,
  onGoToSlide,
  onNext,
  onPrev,
}: SlidePreviewProps) {
  // 键盘翻页
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNext, onPrev]);

  const currentSlide = slides[currentIndex];
  const totalSlides = slides.length;
  const doneCount = slides.filter((s) => s.status === "done").length;

  return (
    <div className="space-y-4">
      {/* 主视图区域 */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        {/* 幻灯片展示 */}
        <div className="relative px-4 pt-4 pb-2">
          <div className="bg-white rounded-lg overflow-hidden shadow-2xl mx-auto"
               style={{ maxWidth: "960px" }}>
            {currentSlide?.html ? (
              <SlideIframe html={currentSlide.html} autoScale />
            ) : currentSlide?.status === "failed" ? (
              /* 失败降级卡片 */
              <div className="aspect-video bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none"
                       stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-gray-400">此页生成失败</p>
                </div>
              </div>
            ) : (
              /* loading 骨架 */
              <div className="aspect-video bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                  <svg className="animate-spin w-8 h-8 text-blue-400 mx-auto mb-3" fill="none"
                       viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                            stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-sm text-gray-400">正在生成第 {currentIndex + 1} 页...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 翻页控制器 */}
        <div className="flex items-center justify-center gap-4 py-3">
          <button
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30
                       disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <span className="text-sm text-gray-300 font-medium min-w-[100px] text-center">
            {currentIndex + 1} / {totalSlides}
            {doneCount < totalSlides && (
              <span className="text-gray-500 ml-1">
                ({doneCount} 已完成)
              </span>
            )}
          </span>

          <button
            onClick={onNext}
            disabled={currentIndex >= totalSlides - 1}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30
                       disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 底部缩略图导航 */}
      <SlideThumbnailStrip
        slides={slides}
        currentIndex={currentIndex}
        onSelect={onGoToSlide}
      />

      {/* 降级提示 */}
      {currentSlide?.isDowngraded && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none"
               stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-amber-700">此页经过自动布局调整，部分内容可能被裁切</p>
        </div>
      )}
    </div>
  );
}
```

### 4.5 缩略图导航条 — `src/components/SlideThumbnailStrip.tsx`

```typescript
"use client";

/**
 * 底部缩略图导航条
 * 横向滚动展示所有页面的缩略图（缩小版 iframe），当前页高亮
 */

import { useRef, useEffect } from "react";
import SlideIframe from "./SlideIframe";
import type { SlideState } from "@/hooks/useSlideGeneration";

interface SlideThumbnailStripProps {
  slides: SlideState[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

const THUMB_WIDTH = 160;  // 缩略图宽度 px
const THUMB_SCALE = THUMB_WIDTH / 1280; // ~0.125

export default function SlideThumbnailStrip({
  slides,
  currentIndex,
  onSelect,
}: SlideThumbnailStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动将当前页滚动到可见区域
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const thumbEl = container.children[currentIndex] as HTMLElement | undefined;
    if (thumbEl) {
      thumbEl.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentIndex]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-300"
      >
        {slides.map((slide, index) => (
          <button
            key={index}
            onClick={() => onSelect(index)}
            className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all
              ${index === currentIndex
                ? "border-blue-500 shadow-md"
                : "border-transparent hover:border-gray-300"
              }`}
            style={{ width: THUMB_WIDTH }}
          >
            {slide.html ? (
              <SlideIframe
                html={slide.html}
                fixedScale={THUMB_SCALE}
                inert
              />
            ) : slide.status === "failed" ? (
              <div
                className="bg-gray-100 flex items-center justify-center"
                style={{ height: THUMB_WIDTH * (720 / 1280) }}
              >
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor"
                     viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            ) : (
              /* 骨架屏 */
              <div
                className="bg-gray-50 animate-pulse flex items-center justify-center"
                style={{ height: THUMB_WIDTH * (720 / 1280) }}
              >
                <div className="w-4 h-4 rounded-full bg-gray-200" />
              </div>
            )}

            {/* 页码标签 */}
            <div className="text-center py-0.5 bg-gray-50">
              <span className={`text-xs font-medium
                ${index === currentIndex ? "text-blue-600" : "text-gray-400"}`}>
                {index + 1}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

### 4.6 ProgressIndicator 变更 — `src/components/ProgressIndicator.tsx`

```typescript
// ProgressState 新增 slides 字段
export interface ProgressState {
  parse?: StepStatus;
  intent: StepStatus;
  storyline: StepStatus;
  research: StepStatus;
  outline: StepStatus;
  slides: StepStatus;    // 新增
}

// ALL_STEPS 数组末尾新增
const ALL_STEPS = [
  // ...现有 5 个步骤不变...
  {
    key: "slides" as const,
    label: "PPT 预览",
    description: "生成 HTML 幻灯片",
    optional: false,
  },
];
```

### 4.7 页面主组件变更 — `src/app/page.tsx`

核心变更点如下（不贴完整文件，按逻辑分块说明）：

#### 4.7.1 引入新依赖和状态

```typescript
import SlidePreview from "@/components/SlidePreview";
import { useSlideGeneration, type ViewMode } from "@/hooks/useSlideGeneration";

// 在 Home 组件内：
const slideGen = useSlideGeneration();
```

#### 4.7.2 INITIAL_PROGRESS 新增 slides

```typescript
const INITIAL_PROGRESS: ProgressState = {
  intent: "waiting",
  storyline: "waiting",
  research: "waiting",
  outline: "waiting",
  slides: "waiting",     // 新增
};
```

#### 4.7.3 resetState 中重置 slide 状态

```typescript
const resetState = () => {
  // ...现有重置代码...
  slideGen.resetSlides();
};
```

#### 4.7.4 handleSSEEvent 新增事件处理

```typescript
const handleSSEEvent = (event: SSEEvent) => {
  switch (event.type) {
    // ...现有 case 保持不变...

    case "status":
      setProgress((prev) => {
        const next = { ...prev };
        // ...现有逻辑...
        if (event.step === "slides") {
          next.intent = "done";
          next.storyline = "done";
          next.research = "done";
          next.outline = "done";
          next.slides = "running";
        }
        return next;
      });
      break;

    case "outline":
      setOutline(event.data);
      setProgress((prev) => ({ ...prev, outline: "done" }));
      // 设置 slide 生成上下文
      slideGen.setContext(event.data, llmConfig);
      break;

    case "slides_start":
      slideGen.handleSlidesStart(event.totalPages);
      break;

    case "slide_html":
      slideGen.handleSlideHtml(event.pageIndex, event.html);
      break;

    case "slide_error":
      slideGen.handleSlideError(event.pageIndex, event.message);
      break;

    case "done":
      setAppStatus("done");
      setProgress((prev) => ({ ...prev, slides: "done" }));
      // 延迟检查所有 slide 是否完成（等待异步爆版检测+重试）
      setTimeout(() => slideGen.checkAllComplete(), 500);
      break;
  }
};
```

#### 4.7.5 Tab 切换 UI

在 `<main>` 中，OutlineDisplay 之前添加 Tab 切换：

```tsx
{/* Tab 切换（大纲生成完成后显示） */}
{outline && (
  <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
    <button
      onClick={() => slideGen.setViewMode("outline")}
      className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors
        ${slideGen.viewMode === "outline"
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-500 hover:text-gray-700"
        }`}
    >
      大纲视图
    </button>
    <button
      onClick={() => slideGen.setViewMode("preview")}
      disabled={!slideGen.slidesPhaseActive}
      className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors
        ${slideGen.viewMode === "preview"
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-500 hover:text-gray-700"
        }
        ${!slideGen.slidesPhaseActive ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      PPT 预览
      {slideGen.slidesPhaseActive && slideGen.slides.length > 0 && (
        <span className="ml-1 text-xs text-gray-400">
          ({slideGen.slides.filter(s => s.status === "done").length}/{slideGen.slidesTotal})
        </span>
      )}
    </button>
  </div>
)}

{/* 根据 Tab 显示对应视图 */}
{showResult && slideGen.viewMode === "outline" && (
  <OutlineDisplay ... />
)}

{slideGen.viewMode === "preview" && slideGen.slidesPhaseActive && (
  <SlidePreview
    slides={slideGen.slides}
    currentIndex={slideGen.currentSlideIndex}
    onGoToSlide={slideGen.goToSlide}
    onNext={slideGen.goNext}
    onPrev={slideGen.goPrev}
  />
)}
```

---

## 五、数据流与调用关系

```
用户点击「生成」
    |
    v
page.tsx (handleGenerate)
    |-- POST /api/generate (SSE 流)
    |
    v
route.ts --> orchestrator.generateOutline()
    |
    |-- M1 --> onEvent(status/intent)
    |-- M3 --> onEvent(status/storyline)
    |-- M2 --> onEvent(status/research)  [可选]
    |-- M4 --> onEvent(status/page/outline)
    |
    |-- M5 --> onEvent(status:"slides")
    |       |-- onEvent(slides_start)
    |       |-- renderSlidesToHtml() [3 路并发]
    |       |     |-- renderSingleSlide(page[0]) --> onEvent(slide_html(0))
    |       |     |-- renderSingleSlide(page[1]) --> onEvent(slide_html(1))
    |       |     |-- renderSingleSlide(page[2]) --> onEvent(slide_html(2))
    |       |     |-- ... (信号量控制)
    |       |-- onEvent(done)
    |
    v
page.tsx (handleSSEEvent)
    |-- "slides_start"  --> useSlideGeneration.handleSlidesStart()
    |-- "slide_html"    --> useSlideGeneration.handleSlideHtml()
    |                        |-- 立即更新 slides[] 状态
    |                        |-- 后台 detectOverflow()
    |                        |     |-- 没爆版 --> 完成
    |                        |     |-- 爆版 --> retrySlide()
    |                        |                  |-- POST /api/generate-slide (isRetry=true)
    |                        |                  |-- 再次 detectOverflow()
    |                        |                  |-- 成功 --> 更新 HTML
    |                        |                  |-- 仍爆版 + 次数用尽 --> injectOverflowFix()
    |-- "slide_error"   --> useSlideGeneration.handleSlideError()
    |-- "done"          --> checkAllComplete() --> setViewMode("preview")
    |
    v
SlidePreview
    |-- SlideIframe (主视图，autoScale)
    |-- SlideThumbnailStrip
         |-- SlideIframe * N (fixedScale=0.125, inert)
```

---

## 六、开发顺序与依赖关系

```
批次 1（无依赖，可并行）:
  T1: src/agent/prompts/m5-slide.ts           -- prompt 模板
  T2: src/lib/overflow-detector.ts            -- 爆版检测工具
  T3: src/components/SlideIframe.tsx           -- iframe 渲染组件

批次 2（依赖 T1）:
  T4: src/agent/modules/m5-slide-renderer.ts  -- M5 模块（依赖 T1 的 prompt）
  T5: src/types/api.ts 修改                   -- SSE 事件类型扩展

批次 3（依赖 T4, T5）:
  T6: src/agent/orchestrator.ts 修改          -- M5 集成（依赖 T4, T5）
  T7: src/app/api/generate-slide/route.ts     -- 重试 API（依赖 T4）

批次 4（依赖 T2, T3, T5）:
  T8: src/hooks/useSlideGeneration.ts         -- 状态管理 hook（依赖 T2, T5）
  T9: src/components/SlideThumbnailStrip.tsx   -- 缩略图导航（依赖 T3）

批次 5（依赖 T8, T9）:
  T10: src/components/SlidePreview.tsx         -- 预览主组件（依赖 T3, T9）
  T11: src/components/ProgressIndicator.tsx    -- 进度条扩展

批次 6（依赖全部）:
  T12: src/app/page.tsx 修改                  -- 主页面集成（依赖 T6-T11）

批次 7:
  T13: 联调测试 + 体验打磨
```

**建议实际开发顺序（单人线性）：**

```
1. T5  -- types/api.ts 扩展（5 分钟，改 3 行）
2. T1  -- prompts/m5-slide.ts（30 分钟）
3. T4  -- m5-slide-renderer.ts（1 小时）
4. T6  -- orchestrator.ts 修改（15 分钟）
5. T7  -- generate-slide API（30 分钟）
6. T2  -- overflow-detector.ts（20 分钟）
7. T3  -- SlideIframe.tsx（30 分钟）
8. T9  -- SlideThumbnailStrip.tsx（30 分钟）
9. T10 -- SlidePreview.tsx（1 小时）
10. T8  -- useSlideGeneration.ts（1 小时）
11. T11 -- ProgressIndicator 修改（10 分钟）
12. T12 -- page.tsx 集成（1 小时）
13. T13 -- 联调测试（2 小时）
```

---

## 七、关键实现要点与注意事项

### 7.1 SSE 连接超时风险

M1-M5 全流程可能耗时 60-90 秒。Vercel 的 Serverless Functions 默认超时为 60 秒（Pro 版可达 300 秒）。

**应对措施**：
- 在 SSE 流中每 15 秒发送心跳事件（`{type: "heartbeat"}`）
- 如果使用 Vercel，需在 `vercel.json` 中配置 `maxDuration`

在 `route.ts` 的 `start(controller)` 中添加心跳：

```typescript
// 心跳保活（每 15 秒）
const heartbeatInterval = setInterval(() => {
  controller.enqueue(encoder.encode(`: heartbeat\n\n`));
}, 15000);

try {
  await generateOutline(input, sendEvent);
} finally {
  clearInterval(heartbeatInterval);
  controller.close();
}
```

### 7.2 baseUrl vs baseURL 字段名差异

前端 `LLMConfig` 用 `baseUrl`，后端 `LLMClientConfig` 用 `baseURL`。在 `generate-slide/route.ts` 中需要做转换。

### 7.3 并发与速率限制

DashScope qwen-max 的默认并发限制通常在 5-10 QPS。M5 的 3 并发加上可能的爆版重试，峰值可能达到 4-5 并发。当前配置是安全的，但如果用户同时发起多次生成请求，需要注意。

### 7.4 多 iframe 性能

12 个缩略图 iframe 同时渲染可能影响性能。优化措施：
- 缩略图 iframe 使用 `pointer-events:none` 和 `tabIndex={-1}`
- 已通过 `sandbox="allow-same-origin"` 禁止 JS 执行
- 后续可考虑 Intersection Observer 做懒加载

### 7.5 前端爆版检测的时序

`handleSlideHtml` 是 async 函数，在 SSE 事件循环中调用时不会阻塞后续事件处理。爆版检测和重试在后台异步进行，不影响其他页面的接收。

### 7.6 SSEEvent 的 type 字段扩展

前端 `handleSSEEvent` 中的 `switch (event.type)` 需要新增 `case "slides_start"` / `case "slide_html"` / `case "slide_error"`。由于 TypeScript 的联合类型判断，不需要额外的类型断言。

### 7.7 slide_html 事件的数据量

单页 HTML 约 3-8KB，12 页总计约 36-96KB。SSE 传输无压力。但需注意 JSON.stringify 对 HTML 中的特殊字符（引号、换行）的转义。当前 `formatSSE` 使用 `JSON.stringify(event)` 已自动处理。

---

## 八、验收标准

### 8.1 功能验收

- [ ] 输入主题后，大纲生成完成自动进入 HTML 生成阶段
- [ ] 进度条正确显示「PPT 预览」步骤的状态
- [ ] HTML 生成过程中，每完成一页就通过 SSE 推送到前端
- [ ] 前端收到 HTML 后用 iframe 正确渲染 16:9 页面
- [ ] 缩略图导航条正确显示已完成/生成中/失败状态
- [ ] 点击缩略图可跳转，键盘左右箭头可翻页
- [ ] Tab 切换在大纲视图和 PPT 预览之间正常工作
- [ ] 全部生成完成后自动切换到 PPT 预览视图
- [ ] 爆版页面被检测并自动重试（最多 2 次）
- [ ] 重试失败后应用 CSS 降级处理，页面不为空白
- [ ] `/api/generate-slide` 可独立调用并返回正确的 HTML

### 8.2 性能验收

- [ ] 12 页 PPT 的 HTML 生成总时间 < 30 秒
- [ ] 前端翻页操作流畅，无明显卡顿
- [ ] 爆版检测耗时 < 500ms，用户无感

### 8.3 错误处理验收

- [ ] 单页 LLM 调用失败不影响其他页面
- [ ] 网络中断时前端正确显示错误提示
- [ ] SSE 连接超时有心跳保活机制
