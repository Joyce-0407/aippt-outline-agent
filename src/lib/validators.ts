/**
 * Zod Schema 校验器
 * 用于校验 M1/M3/M4 各模块的 LLM 输出是否符合预期结构
 */

import { z } from "zod";
import type { IntentAnalysis } from "@/types/intent";
import type { Storyline } from "@/types/storyline";
import type { PPTOutline } from "@/types/outline";

// ============================================================
// M1 意图分析 Schema
// ============================================================

/** M1 输出的 Zod Schema */
export const intentAnalysisSchema = z.object({
  /** PPT 用途 */
  purpose: z.string().min(1, "purpose 不能为空"),
  /** 目标受众 */
  audience: z.string().min(1, "audience 不能为空"),
  /** 场景类型，Phase 1 固定为 B */
  scenarioType: z.enum(["A", "B", "C"]),
  /** 推荐页数，5-30 之间 */
  pageCountSuggestion: z.number().int().min(5).max(30),
  /** 风格提示 */
  styleHint: z.string().min(1, "styleHint 不能为空"),
  /** 主题关键词，3-5 个 */
  topicKeywords: z.array(z.string()).min(1).max(10),
  /** 核心信息（一句话） */
  coreMessage: z.string().min(1, "coreMessage 不能为空"),
  /** 置信度 0-1 */
  confidence: z.number().min(0).max(1),
});

// ============================================================
// M3 故事线 Schema
// ============================================================

/** 章节 Schema */
const sectionSchema = z.object({
  /** 章节标题 */
  title: z.string().min(1),
  /** 章节目的 */
  purpose: z.string().min(1),
  /** 页码范围 [起始页, 结束页] */
  pageRange: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  /** 章节核心信息 */
  keyMessage: z.string().min(1),
});

/** M3 输出的 Zod Schema */
export const storylineSchema = z.object({
  /** 叙事框架 */
  narrativeFramework: z.string().min(1),
  /** 核心信息（一句话） */
  coreMessage: z.string().min(1),
  /** 情感曲线描述 */
  emotionalCurve: z.string().min(1),
  /** 章节列表，至少 2 个章节 */
  sections: z.array(sectionSchema).min(2),
  /** 总页数 */
  totalPages: z.number().int().min(1),
});

// ============================================================
// M4 大纲 Schema
// ============================================================

/** 内容块类型枚举 */
const contentBlockTypeSchema = z.enum([
  "point",
  "quote",
  "data",
  "imageSuggestion",
  "chartSuggestion",
]);

/** 内容块 Schema */
const contentBlockSchema = z.object({
  type: contentBlockTypeSchema,
  title: z.string().optional(),
  detail: z.string().min(1, "内容块 detail 不能为空"),
  supportingData: z.string().optional(),
});

/** 页面内容 Schema */
const pageContentSchema = z.object({
  headline: z.string().min(1),
  subheadline: z.string().optional(),
  body: z.array(contentBlockSchema).min(1).max(8),
});

/** 设计建议 Schema */
const pageDesignSchema = z.object({
  layout: z.string().min(1),
  visualElements: z.array(z.string()),
});

/** 单页大纲 Schema */
const pageSchema = z.object({
  pageNumber: z.number().int().min(1),
  section: z.string().min(1),
  title: z.string().min(1),
  creativeIntent: z.string().min(1),
  design: pageDesignSchema,
  content: pageContentSchema,
  speakerNotes: z.string().optional(),
  transitionToNext: z.string().optional(),
});

/** 全局视觉风格 Schema */
const globalDesignSystemSchema = z.object({
  styleTone: z.string().min(1),
  palette: z.array(z.string()).min(1),
  typography: z.string().min(1),
  visualStyle: z.string().min(1),
});

/** 元信息 Schema */
const outlineMetaSchema = z.object({
  title: z.string().min(1),
  purpose: z.string().min(1),
  audience: z.string().min(1),
  totalPages: z.number().int().min(1),
  scenarioType: z.string(),
  designSystem: globalDesignSystemSchema,
});

/** M4 输出的完整大纲 Schema */
export const pptOutlineSchema = z.object({
  meta: outlineMetaSchema,
  storyline: storylineSchema,
  pages: z.array(pageSchema).min(1),
});

// ============================================================
// 校验函数（带详细错误信息）
// ============================================================

/**
 * 校验 M1 意图分析结果
 * @throws 校验失败时抛出包含字段路径的详细错误
 */
export function validateIntentAnalysis(data: unknown): IntentAnalysis {
  const result = intentAnalysisSchema.safeParse(data);
  if (!result.success) {
    const errorMsg = result.error.issues
      .map((issue) => `字段 "${issue.path.join(".")}" 校验失败: ${issue.message}`)
      .join("; ");
    throw new Error(`M1 意图分析结果校验失败: ${errorMsg}`);
  }
  return result.data as IntentAnalysis;
}

/**
 * 校验 M3 故事线结果
 * @throws 校验失败时抛出包含字段路径的详细错误
 */
export function validateStoryline(data: unknown): Storyline {
  const result = storylineSchema.safeParse(data);
  if (!result.success) {
    const errorMsg = result.error.issues
      .map((issue) => `字段 "${issue.path.join(".")}" 校验失败: ${issue.message}`)
      .join("; ");
    throw new Error(`M3 故事线结果校验失败: ${errorMsg}`);
  }
  return result.data as Storyline;
}

/**
 * 校验 M4 大纲结果
 * @throws 校验失败时抛出包含字段路径的详细错误
 */
export function validateOutline(data: unknown): PPTOutline {
  const result = pptOutlineSchema.safeParse(data);
  if (!result.success) {
    const errorMsg = result.error.issues
      .map((issue) => `字段 "${issue.path.join(".")}" 校验失败: ${issue.message}`)
      .join("; ");
    throw new Error(`M4 大纲结果校验失败: ${errorMsg}`);
  }
  return result.data as PPTOutline;
}
