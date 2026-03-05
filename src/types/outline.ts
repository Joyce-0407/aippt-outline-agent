/**
 * PPT 大纲的核心类型定义（M4 输出）
 */

import { Storyline } from "./storyline";

/** 内容块类型 */
export type ContentBlockType =
  | "point"          // 要点
  | "quote"          // 引用
  | "data"           // 数据
  | "imageSuggestion"   // 配图建议
  | "chartSuggestion";  // 图表建议

/** 单个内容块 */
export interface ContentBlock {
  /** 内容类型 */
  type: ContentBlockType;
  /** 可选：内容块标题 */
  title?: string;
  /** 详细内容（具体可用，不是占位符） */
  detail: string;
  /** 可选：支撑数据 */
  supportingData?: string;
}

/** 单页内容 */
export interface PageContent {
  /** 主标题 */
  headline: string;
  /** 可选：副标题 */
  subheadline?: string;
  /** 内容块列表，每页 2-5 个 */
  body: ContentBlock[];
}

/** 单页设计建议 */
export interface PageDesign {
  /** 布局类型，如"标题页"、"三栏并列"、"左图右文"等 */
  layout: string;
  /** 视觉元素建议，如["图标", "数据图表", "配图"] */
  visualElements: string[];
  /** 可选：色调建议 */
  colorTone?: string;
}

/** PPT 单页大纲 */
export interface Page {
  /** 页码，从 1 开始 */
  pageNumber: number;
  /** 所属章节标题 */
  section: string;
  /** 页面标题，最多 15 个字 */
  title: string;
  /** 创作思路：解释这一页为什么这样写（1-2句话） */
  creativeIntent: string;
  /** 设计建议 */
  design: PageDesign;
  /** 页面内容 */
  content: PageContent;
  /** 可选：演讲备注 */
  speakerNotes?: string;
  /** 可选：过渡到下一页的衔接语 */
  transitionToNext?: string;
}

/** 大纲元信息 */
export interface OutlineMeta {
  /** PPT 总标题 */
  title: string;
  /** PPT 用途 */
  purpose: string;
  /** 目标受众 */
  audience: string;
  /** 总页数 */
  totalPages: number;
  /** 场景类型，Phase 1 固定为 B */
  scenarioType: string;
}

/** 完整的 PPT 大纲（最终输出） */
export interface PPTOutline {
  /** 元信息 */
  meta: OutlineMeta;
  /** 故事线 */
  storyline: Storyline;
  /** 逐页大纲，长度应等于 meta.totalPages */
  pages: Page[];
}
