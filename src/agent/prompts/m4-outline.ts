/**
 * M4 大纲细化生成模块的 Prompt 构建函数
 */

import type { IntentAnalysis } from "@/types/intent";
import type { Storyline } from "@/types/storyline";

/** 构建 M4 大纲细化的 User Prompt */
export function buildM4Prompt(
  userInput: string,
  intent: IntentAnalysis,
  storyline: Storyline
): string {
  // 将章节信息格式化为易读文本，注入到 Prompt 中
  const sectionsText = storyline.sections
    .map(
      (s) =>
        `  - ${s.title}（第${s.pageRange[0]}-${s.pageRange[1]}页）：${s.purpose}。核心信息：${s.keyMessage}`
    )
    .join("\n");

  return `## 任务
基于已确定的故事线，为每一页生成详细的 PPT 大纲。必须输出所有 ${storyline.totalPages} 页的完整内容。

## 用户原始输入
"""
${userInput}
"""

## PPT 基本信息
- 用途：${intent.purpose}
- 受众：${intent.audience}
- 风格：${intent.styleHint}
- 核心信息：${storyline.coreMessage}

## 故事线
- 叙事框架：${storyline.narrativeFramework}
- 情感曲线：${storyline.emotionalCurve}
- 章节结构：
${sectionsText}
- 总页数：${storyline.totalPages}

## 每页必须包含的字段

1. **pageNumber**：页码（从1开始）
2. **section**：所属章节标题（与故事线中的章节 title 保持一致）
3. **title**：页面标题（清晰有力，最多15字）
4. **creativeIntent**：创作思路（解释这一页为什么这样写，1-2句话，30-60字）
5. **design**：设计建议
   - layout：布局类型（从以下选择或自定义）：
     "全屏标题页" | "左图右文" | "右图左文" | "三栏并列" | "上下分割" |
     "全图背景+文字叠加" | "数据图表+解读" | "时间轴" | "对比分析" | "要点列表"
   - visualElements：视觉元素建议数组（具体说明，如"展示AI技术演进的时间轴图"而非仅说"时间轴"）
   - colorTone：可选，色调建议（如"深蓝商务风"、"清新绿色"）
6. **content**：页面内容
   - headline：主标题（即页面核心信息的文字表达）
   - subheadline：可选，副标题或补充说明
   - body：内容块数组（每页2-5个，不能为空）
     每个内容块必须包含：
     - type："point"（要点）| "quote"（引用）| "data"（数据）| "imageSuggestion"（配图建议）| "chartSuggestion"（图表建议）
     - title：可选，内容块标题（一般"point"类型有标题）
     - detail：详细内容（必填，具体可用的文字，不能是占位符）
     - supportingData：可选，支撑数据（如用示意数据，请标注"（示意数据）"）
7. **speakerNotes**：可选，演讲时的备注（帮助演讲者记忆要点，1-3句话）
8. **transitionToNext**：可选（最后一页不需要），过渡到下一页的衔接语（自然流畅，1句话）

## 内容质量标准
- 页面标题不超过15字，要有力量感
- body 中的 detail 必须是具体、可直接使用的文字，不能写"在此填入XX"、"请补充XX"等占位符
- 数据如果是虚构的，必须在 supportingData 中标注"（示意数据）"
- 每页内容块数量2-5个
- 第一页通常是封面/标题页，最后一页通常是结尾/致谢页
- 页面之间要有逻辑连贯性，过渡要自然

## 输出 JSON 格式（严格按此格式，pages 数组必须包含全部 ${storyline.totalPages} 页）
{
  "meta": {
    "title": "string -- PPT 总标题（根据内容提炼，简洁有力）",
    "purpose": "${intent.purpose}",
    "audience": "${intent.audience}",
    "totalPages": ${storyline.totalPages},
    "scenarioType": "B"
  },
  "storyline": ${JSON.stringify(storyline)},
  "pages": [
    {
      "pageNumber": 1,
      "section": "string -- 所属章节",
      "title": "string -- 页面标题（≤15字）",
      "creativeIntent": "string -- 创作思路（30-60字）",
      "design": {
        "layout": "string -- 布局类型",
        "visualElements": ["string -- 具体视觉元素描述"],
        "colorTone": "string（可选）"
      },
      "content": {
        "headline": "string -- 主标题",
        "subheadline": "string（可选）",
        "body": [
          {
            "type": "point",
            "title": "string（可选）",
            "detail": "string -- 具体内容，不能是占位符",
            "supportingData": "string（可选）"
          }
        ]
      },
      "speakerNotes": "string（可选）",
      "transitionToNext": "string（可选，最后一页不需要）"
    }
  ]
}

**最重要的要求**：pages 数组必须包含第1页到第${storyline.totalPages}页，共 ${storyline.totalPages} 个元素，不能省略任何一页！`;
}
