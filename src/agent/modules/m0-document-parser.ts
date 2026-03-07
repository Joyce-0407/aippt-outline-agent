/**
 * M0 文档解析模块
 * 支持 PDF、DOCX、Markdown、TXT 文件的解析
 * 使用规则引擎检测分页结构，不调用 LLM
 */

import type { ParsedDocument } from "@/types/document";

// ── 分页检测规则 ────────────────────────────────────────────────────────────

/**
 * 强信号分页模式：出现"第X页"、"Page X"、"Slide X"、"---" + 标题组合
 */
const STRONG_PAGE_PATTERNS = [
  /第\s*\d+\s*页/gi,                    // 中文"第X页"
  /page\s*\d+/gi,                        // 英文"Page X"
  /slide\s*\d+/gi,                       // 幻灯片"Slide X"
  /^-{3,}\s*\n+#{1,3}\s+/gm,            // "---" 分隔线后跟标题
];

/**
 * 检测文本是否有明确的分页标记
 * 规则引擎（无 LLM 调用）
 */
export function detectPageStructure(text: string): boolean {
  // 检测强信号
  for (const pattern of STRONG_PAGE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length >= 2) {
      return true;
    }
  }

  // 检测中信号：连续的 H1/H2 标题（每隔 200 字以上出现）
  const headingMatches = [...text.matchAll(/^#{1,2}\s+.+$/gm)];
  if (headingMatches.length >= 3) {
    // 检查标题之间的平均间距
    let prevIndex = 0;
    let totalGap = 0;
    let gapCount = 0;
    for (const match of headingMatches) {
      if (prevIndex > 0) {
        const gap = (match.index ?? 0) - prevIndex;
        totalGap += gap;
        gapCount++;
      }
      prevIndex = match.index ?? 0;
    }
    const avgGap = gapCount > 0 ? totalGap / gapCount : 0;
    if (avgGap >= 200) {
      return true;
    }
  }

  return false;
}

/**
 * 从文本中提取标题列表
 * 支持 Markdown 标题格式（# ## ###）和全大写行（视为章节标题）
 */
export function extractHeadings(text: string): string[] {
  const headings: string[] = [];

  // 提取 Markdown 格式标题
  const mdHeadings = text.match(/^#{1,3}\s+(.+)$/gm);
  if (mdHeadings) {
    for (const heading of mdHeadings) {
      const cleaned = heading.replace(/^#{1,3}\s+/, "").trim();
      if (cleaned && !headings.includes(cleaned)) {
        headings.push(cleaned);
      }
    }
  }

  // 如果 Markdown 标题太少，尝试提取短行（可能是幻灯片标题）
  if (headings.length < 3) {
    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      // 短行（5-30字）且不是纯标点/数字的行视为潜在标题
      if (
        trimmed.length >= 5 &&
        trimmed.length <= 40 &&
        !/^[\d\s\W]+$/.test(trimmed) &&
        !headings.includes(trimmed)
      ) {
        headings.push(trimmed);
        if (headings.length >= 20) break; // 最多提取 20 个标题
      }
    }
  }

  return headings.slice(0, 20);
}

/**
 * 将有分页结构的文本拆分为页面数组
 */
function splitIntoPages(text: string): string[] {
  // 尝试按"第X页"或"Page X"拆分
  const splitByPageNumber = text.split(/(?=第\s*\d+\s*页|page\s*\d+|slide\s*\d+)/gi);
  if (splitByPageNumber.length >= 2) {
    return splitByPageNumber.map((p) => p.trim()).filter(Boolean);
  }

  // 尝试按 Markdown 分隔线拆分
  const splitByDivider = text.split(/^-{3,}\s*$/gm);
  if (splitByDivider.length >= 2) {
    return splitByDivider.map((p) => p.trim()).filter(Boolean);
  }

  // 尝试按 H1/H2 标题拆分
  const splitByHeading = text.split(/(?=^#{1,2}\s+.+$)/gm);
  if (splitByHeading.length >= 2) {
    return splitByHeading.map((p) => p.trim()).filter(Boolean);
  }

  return [text];
}

// ── 各格式解析器 ────────────────────────────────────────────────────────────

/**
 * 解析 PDF 文件
 */
export async function parsePDF(
  buffer: Buffer,
  filename: string
): Promise<ParsedDocument> {
  // 使用动态导入避免 SSR 问题，pdf-parse 只能在 Node.js 环境中使用
  // pdf-parse 是 CommonJS 模块（export =），动态 import 后整体就是函数
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse: (buffer: Buffer) => Promise<{ text: string; numpages: number }> =
    require("pdf-parse");
  const data = await pdfParse(buffer);
  const rawText = data.text ?? "";

  const hasPageStructure = detectPageStructure(rawText) || data.numpages > 1;
  const headings = extractHeadings(rawText);

  // PDF 按页分割（pdf-parse 已经提供页数信息，但文本是合并的）
  let pages: string[] | undefined;
  if (hasPageStructure) {
    pages = splitIntoPages(rawText);
  }

  return {
    filename,
    fileType: "pdf",
    rawText,
    hasPageStructure,
    pageCount: data.numpages,
    pages,
    headings,
    wordCount: rawText.replace(/\s+/g, "").length,
  };
}

/**
 * 解析 DOCX 文件
 */
export async function parseDocx(
  buffer: Buffer,
  filename: string
): Promise<ParsedDocument> {
  const mammoth = await import("mammoth");
  // 提取纯文本（保留段落结构）
  const result = await mammoth.extractRawText({ buffer });
  const rawText = result.value ?? "";

  const hasPageStructure = detectPageStructure(rawText);
  const headings = extractHeadings(rawText);

  let pages: string[] | undefined;
  if (hasPageStructure) {
    pages = splitIntoPages(rawText);
  }

  return {
    filename,
    fileType: "docx",
    rawText,
    hasPageStructure,
    pageCount: pages?.length,
    pages,
    headings,
    wordCount: rawText.replace(/\s+/g, "").length,
  };
}

/**
 * 解析 Markdown 文件（同步，无需异步）
 */
export function parseMarkdown(text: string, filename: string): ParsedDocument {
  const hasPageStructure = detectPageStructure(text);
  const headings = extractHeadings(text);

  let pages: string[] | undefined;
  if (hasPageStructure) {
    pages = splitIntoPages(text);
  }

  return {
    filename,
    fileType: "md",
    rawText: text,
    hasPageStructure,
    pageCount: pages?.length,
    pages,
    headings,
    wordCount: text.replace(/\s+/g, "").length,
  };
}

/**
 * 解析纯文本文件（同步，无需异步）
 */
export function parseTxt(text: string, filename: string): ParsedDocument {
  const hasPageStructure = detectPageStructure(text);
  const headings = extractHeadings(text);

  let pages: string[] | undefined;
  if (hasPageStructure) {
    pages = splitIntoPages(text);
  }

  return {
    filename,
    fileType: "txt",
    rawText: text,
    hasPageStructure,
    pageCount: pages?.length,
    pages,
    headings,
    wordCount: text.replace(/\s+/g, "").length,
  };
}

// ── 统一入口 ─────────────────────────────────────────────────────────────────

/**
 * 根据文件 MIME 类型选择对应解析器
 */
export async function parseDocument(file: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<ParsedDocument> {
  const { buffer, filename, mimeType } = file;
  const lowerName = filename.toLowerCase();

  // 根据 MIME 类型或文件扩展名判断格式
  if (
    mimeType === "application/pdf" ||
    lowerName.endsWith(".pdf")
  ) {
    return parsePDF(buffer, filename);
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc")
  ) {
    return parseDocx(buffer, filename);
  }

  // Markdown 和 TXT 先转为字符串再解析
  const text = buffer.toString("utf-8");

  if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown")) {
    return parseMarkdown(text, filename);
  }

  // 默认当作纯文本处理
  return parseTxt(text, filename);
}
