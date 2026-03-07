/**
 * M5 质量审查模块的 Prompt 构建函数
 * 审查 M4 生成的大纲：逻辑连贯性、内容完整性、用户意图对齐
 */

import type { IntentAnalysis } from "@/types/intent";
import type { PPTOutline } from "@/types/outline";

export function buildM5Prompt(
  userInput: string,
  intent: IntentAnalysis,
  outline: PPTOutline
): string {
  const pagesPreview = outline.pages
    .map(
      (p) =>
        `第${p.pageNumber}页 [${p.section}] "${p.title}" — ${p.content.body.length}个内容块`
    )
    .join("\n");

  return `## 任务
你是 PPT 大纲质量审查专家。请对以下已生成的 PPT 大纲进行全面审查，找出问题并给出具体修改建议。

## 用户原始需求
"""
${userInput}
"""

## 意图分析结果
- 用途：${intent.purpose}
- 受众：${intent.audience}
- 风格：${intent.styleHint}
- 核心信息：${intent.coreMessage}

## 当前大纲概览
- 标题：${outline.meta.title}
- 总页数：${outline.pages.length}
- 叙事框架：${outline.storyline.narrativeFramework}
- 页面列表：
${pagesPreview}

## 完整大纲 JSON
${JSON.stringify(outline, null, 0)}

## 审查维度（逐项评分 1-5 分）

1. **意图对齐**：大纲是否回应了用户最初的需求？核心信息是否贯穿全文？
2. **逻辑连贯性**：页面之间的逻辑是否通顺？有无跳跃或重复？章节过渡是否自然？
3. **内容完整性**：是否覆盖了用户的所有要点？有无明显遗漏？
4. **信息密度**：每页信息量是否合理？有无过满或过空的页面？
5. **受众匹配**：内容深度和表达方式是否适合目标受众？
6. **实用性**：内容是否具体可用？有无空洞套话或占位符？

## 输出 JSON 格式
{
  "overallScore": 4.2,
  "dimensionScores": {
    "intentAlignment": 4,
    "logicalCoherence": 4,
    "contentCompleteness": 5,
    "informationDensity": 4,
    "audienceMatch": 4,
    "practicality": 4
  },
  "summary": "一句话总结审查结论",
  "issues": [
    {
      "severity": "high" | "medium" | "low",
      "pageNumber": 3,
      "dimension": "logicalCoherence",
      "description": "具体问题描述",
      "suggestion": "具体修改建议"
    }
  ],
  "strengths": ["亮点1", "亮点2"],
  "refinedPages": []
}

## 重要说明
- issues 数组最多列出 5 个最重要的问题
- severity 为 "high" 的问题表示必须修改
- 如果有 severity 为 "high" 的问题，请在 refinedPages 中给出修改后的完整页面 JSON（仅修改有问题的页面）
- 如果大纲整体质量良好（overallScore >= 4.0 且无 high 问题），refinedPages 可为空数组
- overallScore 是 6 个维度的加权平均，保留 1 位小数`;
}
