/**
 * M1 意图分析模块的 Prompt 构建函数
 */

/** 构建 M1 意图分析的 User Prompt */
export function buildM1Prompt(
  userInput: string,
  options?: { purpose?: string; audience?: string }
): string {
  // 如果用户已指定某些字段，在 Prompt 中告知 LLM 直接使用
  const purposeHint = options?.purpose
    ? `\n**注意**：用户已指定用途为"${options.purpose}"，请直接使用此值，不需要重新推断。`
    : "";
  const audienceHint = options?.audience
    ? `\n**注意**：用户已指定受众为"${options.audience}"，请直接使用此值，不需要重新推断。`
    : "";

  return `## 任务
分析用户的 PPT 制作需求，理解其意图并提取关键信息。

## 用户输入
"""
${userInput}
"""
${purposeHint}${audienceHint}

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
Phase 1 只处理场景 B（主题扩写），即用户给出主题，AI 负责扩展内容。
请固定返回 "scenarioType": "B"。

## 输出 JSON 格式（严格按此格式，不要添加额外字段）
{
  "purpose": "string -- PPT 用途，从上述选项中选择",
  "audience": "string -- 目标受众描述",
  "scenarioType": "B",
  "pageCountSuggestion": number -- 推荐页数（5-30之间的整数）,
  "styleHint": "string -- 风格倾向，从上述选项中选择",
  "topicKeywords": ["string -- 关键词1", "string -- 关键词2"],
  "coreMessage": "string -- 核心信息（一句话，不超过30字）",
  "confidence": number -- 置信度（0-1之间的小数，如0.85）
}`;
}
