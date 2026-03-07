/**
 * POST /api/test-slide — 验证用 LLM 生成单页 PPT HTML 的可行性
 * 输入：一页的大纲数据 + 设计系统 + LLM 配置
 * 输出：LLM 生成的 HTML 字符串
 */

import { NextRequest } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  const { page, designSystem, llmConfig } = await request.json();

  const prompt = `你是一位顶尖的 PPT 视觉设计师，擅长用 HTML + CSS 制作精美的演示文稿页面。

## 任务
根据以下 PPT 页面的内容和设计建议，生成一个完整的、可独立运行的 HTML 页面。

## 全局设计系统
- 风格基调：${designSystem.styleTone}
- 主色板：${designSystem.palette.join("、")}
- 字体风格：${designSystem.typography}
- 视觉风格：${designSystem.visualStyle}

## 本页信息
- 页码：第 ${page.pageNumber} 页
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
${page.content.body.map((b: { type: string; title?: string; detail: string; supportingData?: string }, i: number) => `  ${i + 1}. [${b.type}] ${b.title ? b.title + "：" : ""}${b.detail}${b.supportingData ? `（数据：${b.supportingData}）` : ""}`).join("\n")}

## 要求

1. 输出一个完整的 HTML 页面（包含 <!DOCTYPE html>、<html>、<head>、<body>）
2. 页面尺寸固定为 16:9 比例（1280x720px），居中显示，overflow hidden
3. 所有样式用内联 <style> 标签写在 <head> 中，不要引用外部 CSS
4. 可以使用 Google Fonts（通过 @import），选择与设计系统匹配的字体
5. 颜色方案严格遵循主色板
6. 布局要精确匹配设计建议中的布局类型
7. 对于 imageSuggestion 类型的内容块，用精美的占位区域表示（渐变背景 + SVG 图标 + 描述文字），不要用灰色方块
8. 对于 chartSuggestion 类型的内容块，用 SVG 绘制一个示意性的图表（不需要真实数据，但视觉上要像一个真实图表）
9. 对于 data 类型的内容块，用醒目的大字号突出数据
10. 页面要有专业的视觉层次感：标题 > 副标题 > 正文，留白合理
11. 可以适当添加装饰性元素（渐变色块、线条、圆形等）提升视觉品质
12. 不要使用 JavaScript

## 输出格式
直接输出 HTML 代码，不要用 markdown 代码块包裹，不要有任何额外说明文字。第一个字符必须是 < 。`;

  try {
    const client = new OpenAI({
      apiKey: llmConfig.apiKey,
      baseURL: llmConfig.baseUrl,
    });

    const response = await client.chat.completions.create({
      model: llmConfig.model,
      messages: [
        { role: "user", content: prompt },
      ],
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

    return Response.json({ html });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "生成失败" },
      { status: 500 }
    );
  }
}
