/**
 * M6 HTML 幻灯片生成模块
 * 接收完整大纲，为每页调用 LLM 生成独立的 HTML 页面
 * 采用信号量（Semaphore）模式控制最多 3 路并发，生成完一页立即回调
 */

import OpenAI from "openai";
import type { Page, GlobalDesignSystem, PPTOutline } from "@/types/outline";
import type { LLMClientConfig } from "@/lib/llm-client";

/** 最大并发数 */
const MAX_CONCURRENCY = 3;

/** 单页 LLM 调用最大重试次数（API 调用失败时的重试，不含爆版重试） */
const MAX_API_RETRIES = 2;

/**
 * 简易信号量实现：同时最多允许 MAX_CONCURRENCY 个任务并发执行
 */
class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  /** 申请一个许可，若无可用许可则等待 */
  acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  /** 释放一个许可，唤醒等待队列中的下一个任务 */
  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.permits++;
    }
  }
}

/**
 * 构建单页 HTML 生成的 prompt
 * 直接复用 test-slide/route.ts 中已验证的 prompt 结构，并加强防溢出约束
 *
 * @param page - 当前页大纲数据
 * @param designSystem - 全局视觉风格
 * @param totalPages - 总页数（用于提供页码上下文）
 * @param retryHint - 重试时追加的约束提示（可选）
 */
function buildSlidePrompt(
  page: Page,
  designSystem: GlobalDesignSystem,
  totalPages: number,
  retryHint?: string
): string {
  // 构建内容块描述
  const bodyText = page.content.body
    .map(
      (b, i) =>
        `  ${i + 1}. [${b.type}] ${b.title ? b.title + "：" : ""}${b.detail}${b.supportingData ? `（数据：${b.supportingData}）` : ""}`
    )
    .join("\n");

  let prompt = `你是一位顶尖的 PPT 视觉设计师，擅长用 HTML + CSS 制作精美的演示文稿页面。

## 任务
根据以下 PPT 页面的内容和设计建议，生成一个完整的、可独立运行的 HTML 页面。

## 全局设计系统
- 风格基调：${designSystem.styleTone}
- 主色板：${designSystem.palette.join("、")}
- 字体风格：${designSystem.typography}
- 视觉风格：${designSystem.visualStyle}

## 本页信息
- 页码：第 ${page.pageNumber} 页 / 共 ${totalPages} 页
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
${bodyText}

## 基础要求

1. 输出一个完整的 HTML 页面（包含 <!DOCTYPE html>、<html>、<head>、<body>）
2. 颜色方案严格遵循主色板
3. 布局要精确匹配设计建议中的布局类型
4. 所有样式用内联 <style> 标签写在 <head> 中，不要引用外部 CSS
5. 可以使用 Google Fonts（通过 @import），选择与设计系统匹配的字体
6. 对于 imageSuggestion 类型的内容块，用精美的占位区域表示（渐变背景 + SVG 图标 + 描述文字），不要用灰色方块
7. 对于 chartSuggestion 类型的内容块，用 SVG 绘制一个示意性的图表（不需要真实数据，但视觉上要像一个真实图表）
8. 对于 data 类型的内容块，用醒目的大字号突出数据
9. 页面要有专业的视觉层次感：标题 > 副标题 > 正文，留白合理
10. 可以适当添加装饰性元素（渐变色块、线条、圆形等）提升视觉品质
11. 不要使用 JavaScript

## 关键尺寸约束（必须严格遵守，违反将导致输出不可用）

1. html 和 body 必须设置：width:1280px; height:720px; overflow:hidden; margin:0; padding:0
2. 页面总尺寸固定为 1280×720px，所有内容必须完整显示在此区域内，不允许任何溢出
3. 内容区域建议使用 padding: 50px 70px，确保内容不贴边，四周有足够留白
4. 所有容器必须设置 overflow:hidden，防止内容溢出容器边界
5. 字号上限：主标题不超过 48px，章节/副标题不超过 28px，正文不超过 18px，注释不超过 14px
6. 文字行数限制：标题最多 2 行，正文每个要点最多 3 行，超出部分必须用 text-overflow:ellipsis 截断
7. 内容块数量超过 4 个时，必须缩小字号或使用更紧凑的布局（如网格），确保全部在区域内显示
8. 不要使用会导致内容溢出的 CSS：不要让 position:absolute 的元素超出 1280×720 的范围
9. 设置 box-sizing:border-box 确保内边距不会撑大容器

## 输出格式
直接输出 HTML 代码，不要用 markdown 代码块包裹，不要有任何额外说明文字。第一个字符必须是 < 。`;

  // 重试时追加额外约束
  if (retryHint) {
    prompt += `\n\n## 重要修正\n\n${retryHint}`;
  }

  return prompt;
}

/**
 * 为单页生成 HTML
 * 内部带有 API 级别的重试（网络失败/限流时重试，不处理爆版）
 *
 * @param page - 当前页大纲数据
 * @param designSystem - 全局视觉风格
 * @param config - LLM 客户端配置
 * @param totalPages - 总页数（用于 prompt 中的页码上下文）
 * @param retryHint - 重试时追加的提示（由调用方传入）
 */
export async function generateSlideHTML(
  page: Page,
  designSystem: GlobalDesignSystem,
  config: LLMClientConfig,
  totalPages: number = 0,
  retryHint?: string
): Promise<string> {
  const prompt = buildSlidePrompt(page, designSystem, totalPages, retryHint);

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  let lastError: Error | null = null;

  // API 调用失败时最多重试 MAX_API_RETRIES 次
  for (let attempt = 1; attempt <= MAX_API_RETRIES + 1; attempt++) {
    try {
      console.log(
        `[M6] 生成第 ${page.pageNumber} 页 HTML（第 ${attempt} 次尝试）`
      );

      const response = await client.chat.completions.create({
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 8192,
      });

      let html = response.choices[0]?.message?.content ?? "";

      if (!html) {
        throw new Error("LLM 返回内容为空");
      }

      // 清理可能的 markdown 代码块包裹
      html = html.trim();
      if (html.startsWith("```html")) html = html.slice(7);
      if (html.startsWith("```")) html = html.slice(3);
      if (html.endsWith("```")) html = html.slice(0, -3);
      html = html.trim();

      // 基本校验：必须是 HTML 内容
      if (!html.includes("<") || !html.includes("html")) {
        throw new Error(`返回内容不是有效的 HTML：${html.substring(0, 100)}`);
      }

      console.log(`[M6] 第 ${page.pageNumber} 页 HTML 生成成功，长度：${html.length}`);
      return html;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("未知错误");
      console.warn(
        `[M6] 第 ${page.pageNumber} 页第 ${attempt} 次尝试失败：${lastError.message}`
      );

      if (attempt <= MAX_API_RETRIES) {
        // 等待后重试（指数退避：1s、2s）
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw lastError ?? new Error(`第 ${page.pageNumber} 页 HTML 生成失败`);
}

/**
 * 批量并发生成所有页面的 HTML
 * 采用信号量控制最多 MAX_CONCURRENCY 路并发
 * 每生成完一页立即调用对应回调，不等待全部完成
 *
 * @param outline - 完整的 PPT 大纲
 * @param config - LLM 客户端配置
 * @param onSlideReady - 单页成功回调，参数为 1-based pageNumber 和 HTML 字符串
 * @param onSlideError - 单页失败回调，参数为 1-based pageNumber 和错误信息
 */
export async function renderAllSlides(
  outline: PPTOutline,
  config: LLMClientConfig,
  onSlideReady: (pageNumber: number, html: string) => void,
  onSlideError: (pageNumber: number, error: string) => void
): Promise<void> {
  const { pages, meta } = outline;
  const totalPages = pages.length;
  const semaphore = new Semaphore(MAX_CONCURRENCY);

  console.log(`[M6] 开始生成 ${totalPages} 页 HTML，并发数：${MAX_CONCURRENCY}`);

  // 为每页创建一个任务，通过信号量限制并发
  const tasks = pages.map((page) =>
    (async () => {
      // 申请信号量许可（若已有 MAX_CONCURRENCY 个任务在跑则等待）
      await semaphore.acquire();

      try {
        const html = await generateSlideHTML(
          page,
          meta.designSystem,
          config,
          totalPages
        );
        onSlideReady(page.pageNumber, html);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "未知错误";
        console.error(`[M6] 第 ${page.pageNumber} 页生成最终失败：${errMsg}`);
        onSlideError(page.pageNumber, errMsg);
      } finally {
        // 无论成功失败都要释放信号量，让下一个任务得以执行
        semaphore.release();
      }
    })()
  );

  // 等待所有任务完成（allSettled 不会因单个失败而中止其他任务）
  await Promise.allSettled(tasks);

  console.log(`[M6] 全部 ${totalPages} 页处理完毕`);
}
