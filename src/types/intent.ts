/**
 * M1 意图分析模块的类型定义
 */

/** PPT 用途枚举 */
export type PurposeType =
  | "工作汇报"
  | "商业提案"
  | "教学课件"
  | "演讲分享"
  | "产品介绍"
  | "项目总结"
  | "竞品分析"
  | "培训材料"
  | "其他";

/** 风格倾向枚举 */
export type StyleHintType =
  | "正式严谨"
  | "轻松活泼"
  | "数据驱动"
  | "故事驱动"
  | "视觉导向";

/** 场景类型，Phase 1 固定为 B（主题扩写模式） */
export type ScenarioType = "B";

/** M1 意图分析结果 */
export interface IntentAnalysis {
  /** PPT 用途 */
  purpose: string;
  /** 目标受众 */
  audience: string;
  /** 场景类型（Phase 1 固定为 B） */
  scenarioType: ScenarioType;
  /** LLM 推荐的页数 */
  pageCountSuggestion: number;
  /** 风格提示 */
  styleHint: string;
  /** 主题关键词列表 */
  topicKeywords: string[];
  /** 核心信息：这个 PPT 最终要传达的核心观点 */
  coreMessage: string;
  /** 分析置信度（0-1），Phase 1 低置信度时也直接使用，不追问 */
  confidence: number;
}
