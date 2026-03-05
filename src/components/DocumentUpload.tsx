"use client";

/**
 * 文档上传组件
 * 支持拖拽/点击上传，解析 PDF/DOCX/MD/TXT，展示解析结果
 */

import { useState, useRef, useCallback } from "react";
import type { ParsedDocument } from "@/types/document";
import type { DocumentContext } from "@/types/api";

/** 场景类型对应的中文说明 */
const SCENARIO_LABELS: Record<string, { label: string; color: string; description: string }> = {
  A: {
    label: "结构化还原",
    color: "bg-blue-100 text-blue-700",
    description: "文档有明确分页，AI 将按原始结构生成大纲",
  },
  B: {
    label: "主题扩写",
    color: "bg-green-100 text-green-700",
    description: "无文档，AI 将自由创作扩展",
  },
  C: {
    label: "散乱重组",
    color: "bg-amber-100 text-amber-700",
    description: "文档结构散乱，AI 将重新梳理逻辑",
  },
};

/** 支持的文件类型说明 */
const ACCEPTED_FILE_TYPES = ".pdf,.docx,.doc,.md,.markdown,.txt";

/** 根据解析结果判断场景类型 */
function detectScenario(docs: ParsedDocument[]): "A" | "B" | "C" {
  if (docs.length === 0) return "B";
  const hasStructure = docs.some((d) => d.hasPageStructure);
  return hasStructure ? "A" : "C";
}

/** 格式化文件大小显示 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 文件图标（根据类型） */
function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const colorMap: Record<string, string> = {
    pdf: "text-red-500",
    docx: "text-blue-500",
    doc: "text-blue-500",
    md: "text-purple-500",
    markdown: "text-purple-500",
    txt: "text-gray-500",
  };
  const color = colorMap[ext ?? ""] ?? "text-gray-500";
  return (
    <svg className={`w-5 h-5 ${color} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

interface UploadedFile {
  file: File;
  /** 上传状态 */
  status: "pending" | "uploading" | "done" | "error";
  /** 解析结果 */
  parsed?: ParsedDocument;
  /** 错误信息 */
  error?: string;
}

export interface DocumentUploadProps {
  /** 解析完成时回调，将文档列表传给父组件 */
  onDocumentsChange: (documents: DocumentContext[]) => void;
  /** 是否在生成中（禁用上传） */
  disabled?: boolean;
}

export default function DocumentUpload({ onDocumentsChange, disabled }: DocumentUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 将解析结果列表转换为 DocumentContext 格式并通知父组件 */
  const notifyParent = useCallback(
    (files: UploadedFile[]) => {
      const docs: DocumentContext[] = files
        .filter((f) => f.status === "done" && f.parsed)
        .map((f) => ({
          filename: f.parsed!.filename,
          content: f.parsed!.rawText,
          hasPageStructure: f.parsed!.hasPageStructure,
          pages: f.parsed!.pages,
          headings: f.parsed!.headings,
        }));
      onDocumentsChange(docs);
    },
    [onDocumentsChange]
  );

  /** 上传并解析文件列表 */
  const uploadFiles = useCallback(
    async (newFiles: File[]) => {
      if (newFiles.length === 0) return;

      // 检查总文件数（最多3个）
      const currentCount = uploadedFiles.filter((f) => f.status !== "error").length;
      const available = 3 - currentCount;
      if (available <= 0) {
        alert("最多上传 3 个文件");
        return;
      }
      const filesToUpload = newFiles.slice(0, available);

      // 添加 pending 条目
      const pendingEntries: UploadedFile[] = filesToUpload.map((file) => ({
        file,
        status: "uploading",
      }));
      const updatedFiles = [...uploadedFiles, ...pendingEntries];
      setUploadedFiles(updatedFiles);
      setIsUploading(true);

      try {
        const formData = new FormData();
        for (const file of filesToUpload) {
          formData.append("files[]", file);
        }

        const response = await fetch("/api/parse", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          // 全部失败
          const errorMsg = data.error ?? "解析失败";
          setUploadedFiles((prev) =>
            prev.map((f) =>
              pendingEntries.some((p) => p.file === f.file)
                ? { ...f, status: "error", error: errorMsg }
                : f
            )
          );
          return;
        }

        // 将解析结果匹配回对应文件
        const parsedDocs: ParsedDocument[] = data.documents ?? [];
        setParseWarnings(data.warnings ?? []);

        const finalFiles = updatedFiles.map((f) => {
          if (!pendingEntries.some((p) => p.file === f.file)) return f;
          // 找到对应的解析结果（按文件名匹配）
          const parsed = parsedDocs.find((d) => d.filename === f.file.name);
          if (parsed) {
            return { ...f, status: "done" as const, parsed };
          }
          return { ...f, status: "error" as const, error: "解析结果未返回" };
        });

        setUploadedFiles(finalFiles);
        notifyParent(finalFiles);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "网络错误，请重试";
        setUploadedFiles((prev) =>
          prev.map((f) =>
            pendingEntries.some((p) => p.file === f.file)
              ? { ...f, status: "error", error: errorMsg }
              : f
          )
        );
      } finally {
        setIsUploading(false);
      }
    },
    [uploadedFiles, notifyParent]
  );

  /** 删除一个文件 */
  const removeFile = useCallback(
    (index: number) => {
      const newFiles = uploadedFiles.filter((_, i) => i !== index);
      setUploadedFiles(newFiles);
      notifyParent(newFiles);
    },
    [uploadedFiles, notifyParent]
  );

  /** 处理拖拽进入 */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  /** 处理拖拽离开 */
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  /** 处理文件放下 */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
  };

  /** 处理文件选择 */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      uploadFiles(files);
      // 清空 input value 以便重复选择同一文件
      e.target.value = "";
    }
  };

  // 计算当前场景类型
  const parsedDocs = uploadedFiles.filter((f) => f.status === "done" && f.parsed).map((f) => f.parsed!);
  const currentScenario = detectScenario(parsedDocs);
  const scenarioInfo = SCENARIO_LABELS[parsedDocs.length > 0 ? currentScenario : "B"];

  const canUploadMore = uploadedFiles.filter((f) => f.status !== "error").length < 3;
  const hasDoneFiles = parsedDocs.length > 0;

  return (
    <div className="space-y-3">
      {/* 拖拽上传区域 */}
      {canUploadMore && !disabled && (
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer
            ${isDragOver
              ? "border-blue-400 bg-blue-50"
              : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled}
          />

          <div className="flex flex-col items-center gap-2">
            {isUploading ? (
              <svg className="animate-spin w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            )}
            <div>
              <p className="text-sm font-medium text-gray-600">
                {isUploading ? "正在解析文档..." : "拖拽文件到此处，或点击选择"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                支持 PDF、Word、Markdown、TXT（最多 3 个，单文件 ≤ 10MB）
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 已上传文件列表 */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          {uploadedFiles.map((item, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border text-sm
                ${item.status === "error"
                  ? "bg-red-50 border-red-200"
                  : item.status === "uploading"
                    ? "bg-blue-50 border-blue-200"
                    : "bg-white border-gray-200"
                }`}
            >
              {/* 文件图标 */}
              <FileIcon filename={item.file.name} />

              {/* 文件信息 */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{item.file.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatFileSize(item.file.size)}
                  {item.parsed && (
                    <span className="ml-2 text-gray-500">
                      · {item.parsed.wordCount.toLocaleString()} 字
                      {item.parsed.hasPageStructure && " · 有分页结构"}
                    </span>
                  )}
                </p>
                {item.status === "error" && item.error && (
                  <p className="text-xs text-red-500 mt-0.5">{item.error}</p>
                )}
              </div>

              {/* 状态标志 */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.status === "uploading" && (
                  <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {item.status === "done" && (
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {item.status === "error" && (
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {/* 删除按钮 */}
                {!disabled && (
                  <button
                    onClick={() => removeFile(index)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="移除此文件"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 解析结果摘要：展示场景类型 */}
      {hasDoneFiles && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${scenarioInfo.color} text-xs font-medium`}>
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            检测到场景 {currentScenario}（{scenarioInfo.label}）：{scenarioInfo.description}
          </span>
        </div>
      )}

      {/* 解析警告 */}
      {parseWarnings.length > 0 && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-1">
          {parseWarnings.map((warning, i) => (
            <p key={i}>{warning}</p>
          ))}
        </div>
      )}
    </div>
  );
}
