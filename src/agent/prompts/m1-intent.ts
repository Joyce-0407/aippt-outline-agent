/**
 * M1 意图分析模块的 Prompt 构建函数
 */

import type { DocumentContext } from "@/types/api";

/** 构建 M1 意图分析的 User Prompt */
export function buildM1Prompt(
  userInput: string,
  options?: {
    purpose?: string;
    audience?: string;
    documents?: DocumentContext[];
    scenarioType?: "A" | "B" | "C";
  }
): string {
  // 如果用户已指定某些字段，在 Prompt 中告知 LLM 直接使用
  const purposeHint = options?.purpose
    ? `\n**注意**：用户已指定用途为"${options.purpose}"，请直接使用此值，不需要重新推断。`
    : "";
  const audienceHint = options?.audience
    ? `\n**注意**：用户已指定受众为"${options.audience}"，请直接使用此值，不需要重新推断。`
    : "";

  // 构建文档上下文信息（注入到 Prompt 中）
  let documentContext = "";
  if (options?.documents && options.documents.length > 0) {
    const docSummaries = options.documents
      .map((doc, i) => {
        const preview = doc.content.slice(0, 300).replace(/\n+/g, " ");
        return `文档${i + 1}（${doc.filename}）：
  - 字数：${doc.content.length}字
  - 有分页结构：${doc.hasPageStructure ? "是" : "否"}
  - 标题列表：${doc.headings.slice(0, 5).join("、") || "未检测到"}
  - 内容预览：${preview}...`;
      })
      .join("\n\n");
    documentContext = `\n\n## 用户上传的文档
${docSummaries}`;
  }

  // 场景类型提示
  let scenarioHint = "";
  if (options?.scenarioType) {
    // 用户手动指定了场景类型
    scenarioHint = `\n**注意**：用户已手动指定场景类型为"${options.scenarioType}"，请直接使用，不需要重新判断。`;
  } else if (options?.documents && options.documents.length > 0) {
    // 有文档时，让 LLM 根据文档结构判断场景
    const hasStructure = options.documents.some((d) => d.hasPageStructure);
    if (hasStructure) {
      scenarioHint = `\n**场景判断提示**：检测到文档有明确的分页结构，建议返回场景类型"A"（结构化还原）。`;
    } else {
      scenarioHint = `\n**场景判断提示**：文档无明确分页结构，内容较散乱，建议返回场景类型"C"（散乱重组）。`;
    }
  } else {
    scenarioHint = `\n**场景判断提示**：用户仅输入了文字，无文档，请返回场景类型"B"（主题扩写）。`;
  }

  return `## 任务
分析用户的 PPT 制作需求，理解其意图并提取关键信息。${documentContext}

## 用户输入
"""
${userInput}
"""
${purposeHint}${audienceHint}${scenarioHint}

## 分析维度

1. **PPT 用途**（从以下选择最匹配的）：
   工作汇报 | 商业提案 | 教学课件 | 演讲分享 | 产品介绍 | 项目总结 | 竞品分析 | 培训材料 | 其他

2. **目标受众**：推断最可能的受众群体（如"公司高层管理者"、"潜在投资人"、"技术团队"等）

3. **风格倾向**（从以下选择最匹配的）：
   正式严谨 | 轻松活泼 | 数据驱动 | 故事驱动 | 视觉导向

4. **推荐页数**：根据内容量和用途合理推荐（5-30页之间）
   - 简短汇报：5-8页
   - 标准演示：10-15页
   - 详细提案/课件：15-25页

5. **主题关键词**：提取 3-5 个核心关键词

6. **核心信息**：这个 PPT 最终要传达的核心观点是什么（一句话概括，不超过30字）

7. **置信度**：你对以上分析的把握程度（0-1）
   - 用户输入详细清晰：0.8-1.0
   - 用户输入一般：0.5-0.8
   - 用户输入非常模糊：0.3-0.5

## 场景类型说明
- A（结构化还原）：用户上传了有明确分页结构的文档，按文档结构生成大纲
- B（主题扩写）：用户只输入了文字主题，AI 负责自由扩展内容
- C（散乱重组）：用户上传了文档但内容结构散乱，需要重新梳理逻辑

## 输出 JSON 格式（严格按此格式，不要添加额外字段）
{
  "purpose": "string -- PPT 用途，从上述选项中选择",
  "audience": "string -- 目标受众描述",
  "scenarioType": "A" | "B" | "C",
  "pageCountSuggestion": number -- 推荐页数（5-30之间的整数）,
  "styleHint": "string -- 风格倾向，从上述选项中选择",
  "topicKeywords": ["string -- 关键词1", "string -- 关键词2"],
  "coreMessage": "string -- 核心信息（一句话，不超过30字）",
  "confidence": number -- 置信度（0-1之间的小数，如0.85）
}`;
}
