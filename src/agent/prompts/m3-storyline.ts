/**
 * M3 故事线构建模块的 Prompt 构建函数
 */

import type { IntentAnalysis } from "@/types/intent";

/** 构建 M3 故事线的 User Prompt */
export function buildM3Prompt(
  userInput: string,
  intent: IntentAnalysis,
  pageCount?: number
): string {
  // 优先使用用户指定的页数，否则使用 M1 推荐的页数
  const targetPages = pageCount ?? intent.pageCountSuggestion;

  return `## 任务
基于用户需求和意图分析结果，构建 PPT 的叙事脉络（Storyline）。

## 用户原始输入
"""
${userInput}
"""

## 意图分析结果
- 用途：${intent.purpose}
- 受众：${intent.audience}
- 风格：${intent.styleHint}
- 核心信息：${intent.coreMessage}
- 关键词：${intent.topicKeywords.join("、")}
- 目标页数：${targetPages} 页

## 可选叙事框架（选择最适合的一个，也可以自定义框架名称）

1. **问题驱动型**：现状 -> 问题/挑战 -> 解决方案 -> 预期效果 -> 行动计划
   适用：工作汇报、项目提案

2. **成果展示型**：背景 -> 目标 -> 执行过程 -> 取得成果 -> 下一步
   适用：项目总结、绩效汇报

3. **方案提案型**：市场机会 -> 我们的方案 -> 核心优势 -> 商业模式 -> 合作方式
   适用：商业提案、产品介绍

4. **教学讲解型**：为什么学 -> 是什么 -> 怎么用 -> 实践练习 -> 总结回顾
   适用：培训课件、教学分享

5. **趋势分析型**：行业背景 -> 关键趋势 -> 影响分析 -> 应对策略 -> 总结展望
   适用：行业分析、战略规划

## 构建要求
1. 选择最合适的叙事框架
2. 确定核心信息（PPT 听完后受众应记住的一句话，不超过25字）
3. 规划 3-6 个章节，每个章节必须包含：
   - title：章节标题（简洁，2-8字）
   - purpose：章节在整体故事中的作用（10-30字说明）
   - pageRange：页码范围，格式为 [起始页码, 结束页码]，从1开始计数
   - keyMessage：该章节最重要的一句话
4. 设计情感曲线（描述受众听完整个PPT的情感变化，用"A -> B -> C"格式）
5. **严格要求**：所有章节的页码范围不能重叠，必须覆盖第1页到第${targetPages}页，总页数必须等于 ${targetPages}

## 输出 JSON 格式（严格按此格式）
{
  "narrativeFramework": "string -- 选择的叙事框架名称",
  "coreMessage": "string -- 核心信息（受众应记住的一句话）",
  "emotionalCurve": "string -- 情感曲线，如 '引发好奇 -> 展示机会 -> 呈现方案 -> 坚定信心'",
  "sections": [
    {
      "title": "string -- 章节标题",
      "purpose": "string -- 章节目的（10-30字）",
      "pageRange": [起始页码, 结束页码],
      "keyMessage": "string -- 章节核心信息"
    }
  ],
  "totalPages": ${targetPages}
}

**重要**：sections 中的 pageRange 必须满足：
- 第一个章节的起始页为 1
- 最后一个章节的结束页为 ${targetPages}
- 相邻章节的页码连续（前一章节结束页+1 = 后一章节起始页）`;
}
