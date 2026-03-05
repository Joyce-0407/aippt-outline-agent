/**
 * POST /api/parse -- 文档解析接口
 * 接收 multipart/form-data，解析上传的文档并返回结构化内容
 */

import { NextRequest } from "next/server";
import { parseDocument } from "@/agent/modules/m0-document-parser";
import type { ParsedDocument } from "@/types/document";

/** 单文件最大大小：10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 支持的文件 MIME 类型 */
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/markdown",
  "text/plain",
  "text/x-markdown",
]);

/** 支持的文件扩展名 */
const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".md", ".markdown", ".txt"]);

/** 检查文件扩展名是否支持 */
function isAllowedFile(filename: string, mimeType: string): boolean {
  const lowerName = filename.toLowerCase();
  const ext = "." + lowerName.split(".").pop();
  return ALLOWED_EXTENSIONS.has(ext) || ALLOWED_MIME_TYPES.has(mimeType);
}

export async function POST(request: NextRequest): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "请求格式错误，需要 multipart/form-data", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  // 获取上传的文件列表（最多3个）
  const files = formData.getAll("files[]") as File[];
  if (!files || files.length === 0) {
    return Response.json(
      { error: "未上传任何文件", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  if (files.length > 3) {
    return Response.json(
      { error: "最多上传 3 个文件", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  const results: ParsedDocument[] = [];
  const errors: string[] = [];

  for (const file of files) {
    // 检查文件类型
    if (!isAllowedFile(file.name, file.type)) {
      errors.push(`文件"${file.name}"格式不支持，请上传 PDF、Word、Markdown 或 TXT 文件`);
      continue;
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`文件"${file.name}"超过 10MB 限制`);
      continue;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const parsed = await parseDocument({
        buffer,
        filename: file.name,
        mimeType: file.type,
      });

      results.push(parsed);
    } catch (error) {
      console.error(`[API/parse] 解析文件"${file.name}"失败:`, error);
      errors.push(
        `文件"${file.name}"解析失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }

  // 若所有文件都失败，返回 400
  if (results.length === 0 && errors.length > 0) {
    return Response.json(
      { error: errors.join("；"), code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  return Response.json({
    documents: results,
    // 若部分文件解析失败，在响应中包含警告信息
    warnings: errors.length > 0 ? errors : undefined,
  });
}
