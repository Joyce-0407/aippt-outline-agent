/**
 * 文档解析相关类型定义
 */

/** 文档解析结果 */
export interface ParsedDocument {
  /** 文件名 */
  filename: string;
  /** 文件类型 */
  fileType: "pdf" | "docx" | "md" | "txt";
  /** 提取的全文 */
  rawText: string;
  /** 是否有明确分页标记（如 "第X页"、"Page X"、分隔线+标题等） */
  hasPageStructure: boolean;
  /** 若有分页，按页存储内容 */
  pages?: string[];
  /** 提取的标题列表 */
  headings: string[];
  /** 总字数 */
  wordCount: number;
}

/** 场景类型
 * A: 结构化还原（文档有明确分页）
 * B: 主题扩写（仅文字输入，无文档）
 * C: 散乱重组（有文档但无结构）
 */
export type ScenarioType = "A" | "B" | "C";
