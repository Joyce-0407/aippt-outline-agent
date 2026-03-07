"use client";

import { useState, useRef, useCallback } from "react";
import type { GenerateRequest, DocumentContext } from "@/types/api";
import type { ParsedDocument } from "@/types/document";

type InputRequest = Omit<GenerateRequest, "llmConfig">;

const EXAMPLE_TOPICS = [
  "帮我做一个关于 AI 在教育中应用的 PPT",
  "Q1 销售业绩汇报，重点分析增长亮点和下季度策略",
  "新产品发布方案，面向科技爱好者群体",
  "数字化转型战略规划，给公司高层汇报",
  "Python 编程入门课件，面向零基础学员",
];


const ACCEPTED_FILE_TYPES = ".pdf,.docx,.doc,.md,.markdown,.txt";

const SCENARIO_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  A: { label: "结构化还原", color: "bg-blue-50 text-blue-700 border-blue-200", desc: "按原始结构生成大纲" },
  B: { label: "主题扩展", color: "bg-green-50 text-green-700 border-green-200", desc: "联网检索补充内容" },
  C: { label: "散乱重组", color: "bg-amber-50 text-amber-700 border-amber-200", desc: "重新梳理文档逻辑" },
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectScenario(docs: ParsedDocument[]): "A" | "C" {
  return docs.some((d) => d.hasPageStructure) ? "A" : "C";
}

interface UploadedFile {
  file: File;
  status: "uploading" | "done" | "error";
  parsed?: ParsedDocument;
  error?: string;
}

interface InputPanelProps {
  onGenerate: (request: InputRequest) => void;
  isGenerating: boolean;
}

export default function InputPanel({ onGenerate, isGenerating }: InputPanelProps) {
  const [userInput, setUserInput] = useState("");
  const [error, setError] = useState("");

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [scenarioOverride, setScenarioOverride] = useState<"A" | "B" | "C" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 从已上传文件中获取 DocumentContext 列表
  const documents: DocumentContext[] = uploadedFiles
    .filter((f) => f.status === "done" && f.parsed)
    .map((f) => ({
      filename: f.parsed!.filename,
      content: f.parsed!.rawText,
      hasPageStructure: f.parsed!.hasPageStructure,
      pageCount: f.parsed!.pageCount,
      pages: f.parsed!.pages,
      headings: f.parsed!.headings,
    }));


  const parsedDocs = uploadedFiles.filter((f) => f.status === "done" && f.parsed).map((f) => f.parsed!);
  const hasDocuments = parsedDocs.length > 0;
  const autoScenario = hasDocuments ? detectScenario(parsedDocs) : "B";
  const scenario = scenarioOverride ?? autoScenario;
  const canUploadMore = uploadedFiles.filter((f) => f.status !== "error").length < 3;
  const isUploading = uploadedFiles.some((f) => f.status === "uploading");

  const uploadFiles = useCallback(async (newFiles: File[]) => {
    if (!newFiles.length) return;
    const available = 3 - uploadedFiles.filter((f) => f.status !== "error").length;
    const toUpload = newFiles.slice(0, available);

    const pending: UploadedFile[] = toUpload.map((file) => ({ file, status: "uploading" }));
    const merged = [...uploadedFiles, ...pending];
    setUploadedFiles(merged);

    try {
      const formData = new FormData();
      toUpload.forEach((f) => formData.append("files[]", f));
      const res = await fetch("/api/parse", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setUploadedFiles((prev) =>
          prev.map((f) => pending.some((p) => p.file === f.file)
            ? { ...f, status: "error", error: data.error ?? "解析失败" } : f)
        );
        return;
      }

      const parsedList: ParsedDocument[] = data.documents ?? [];
      setUploadedFiles((prev) =>
        prev.map((f) => {
          if (!pending.some((p) => p.file === f.file)) return f;
          const parsed = parsedList.find((d) => d.filename === f.file.name);
          return parsed
            ? { ...f, status: "done", parsed }
            : { ...f, status: "error", error: "解析结果未返回" };
        })
      );
    } catch {
      setUploadedFiles((prev) =>
        prev.map((f) => pending.some((p) => p.file === f.file)
          ? { ...f, status: "error", error: "网络错误，请重试" } : f)
      );
    }
  }, [uploadedFiles]);

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!userInput.trim() && documents.length === 0) {
      setError("请输入 PPT 主题，或上传参考文档");
      return;
    }
    setError("");
    const request: InputRequest = { userInput: userInput.trim() };
    if (documents.length > 0) {
      request.documents = documents;
    }
    if (scenario) {
      request.scenarioType = scenario;
    }
    onGenerate(request);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

      {/* ── 文字输入区 ──────────────────────────────────── */}
      <div className="p-5 pb-0">
        <textarea
          value={userInput}
          onChange={(e) => { setUserInput(e.target.value); if (error) setError(""); }}
          disabled={isGenerating}
          placeholder={hasDocuments
            ? "可选：补充说明你的需求，或留空直接用文档生成..."
            : "描述你的 PPT 主题，或在下方上传参考文档..."}
          className="w-full min-h-[100px] p-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none resize-none disabled:cursor-not-allowed bg-transparent"
          maxLength={5000}
        />
      </div>

      {/* ── 分隔线 + 上传区 ──────────────────────────────── */}
      <div className="border-t border-gray-100 mx-5" />

      <div className="px-5 py-3">
        {/* 已上传文件列表 */}
        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {uploadedFiles.map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs border
                  ${item.status === "error" ? "bg-red-50 border-red-200 text-red-600"
                  : item.status === "uploading" ? "bg-blue-50 border-blue-200 text-blue-600"
                  : "bg-gray-50 border-gray-200 text-gray-700"}`}
              >
                {item.status === "uploading" && (
                  <svg className="animate-spin w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                )}
                {item.status === "done" && (
                  <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                )}
                {item.status === "error" && (
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                )}
                <span className="max-w-[120px] truncate" title={item.error || item.file.name}>
                  {item.status === "error" ? (item.error ?? "失败") : item.file.name}
                </span>
                {item.status === "done" && item.parsed && (
                  <span className="text-gray-400">{formatSize(item.file.size)}</span>
                )}
                {!isGenerating && (
                  <button onClick={() => removeFile(i)} className="ml-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 场景选择：始终可见，让用户了解和切换生成模式 */}
        {(hasDocuments || scenarioOverride || userInput.trim().length > 0) && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {(["A", "B", "C"] as const).map((s) => {
              const info = SCENARIO_LABELS[s];
              // 无文档时不允许选 A/C（需要文档）
              const disabled = !hasDocuments && s !== "B";
              const isActive = scenario === s;
              const isAuto = !scenarioOverride && autoScenario === s;
              return (
                <button
                  key={s}
                  disabled={isGenerating || disabled}
                  onClick={() => setScenarioOverride(isActive && scenarioOverride ? null : s)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                    ${isActive ? info.color + " font-medium" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}
                >
                  {s} · {info.label}
                  {isAuto && " (自动)"}
                </button>
              );
            })}
            {scenario && SCENARIO_LABELS[scenario] && (
              <span className="text-xs text-gray-400 ml-1">{SCENARIO_LABELS[scenario].desc}</span>
            )}
          </div>
        )}

        {/* 底部工具栏：上传按钮 + 字数 + 示例 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 上传按钮 */}
          {canUploadMore && !isGenerating && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES}
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) { uploadFiles(files); e.target.value = ""; }
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setIsDragOver(false);
                  uploadFiles(Array.from(e.dataTransfer.files));
                }}
              >
                <svg className={`w-4 h-4 ${isDragOver ? "text-blue-500" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                </svg>
                上传文档
              </button>
              <span className="text-gray-200">|</span>
            </>
          )}

          {/* 示例主题 */}
          <div className="flex flex-wrap gap-1.5 flex-1">
            {EXAMPLE_TOPICS.slice(0, 3).map((topic) => (
              <button
                key={topic}
                onClick={() => { setUserInput(topic); setError(""); }}
                disabled={isGenerating}
                className="text-xs px-2.5 py-1 bg-gray-50 text-gray-500 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-50"
              >
                {topic.slice(0, 16)}…
              </button>
            ))}
          </div>

          {/* 字数 */}
          <span className={`text-xs ml-auto flex-shrink-0 ${userInput.length > 4500 ? "text-red-400" : "text-gray-300"}`}>
            {userInput.length}/5000
          </span>
        </div>
      </div>


      {/* ── 底部：错误 + 生成按钮 ────────────────────────── */}
      <div className="px-5 pb-5 pt-3 border-t border-gray-100">
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={isGenerating || (!userInput.trim() && documents.length === 0)}
          className="w-full py-2.5 px-6 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              生成中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              生成大纲
            </>
          )}
        </button>
      </div>
    </div>
  );
}
