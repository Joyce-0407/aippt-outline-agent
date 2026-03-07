"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { LLMConfig } from "@/types/api";
import type { Page, GlobalDesignSystem } from "@/types/outline";

/** 单页幻灯片状态 */
interface SlideState {
  pageNumber: number;
  html: string;
  status: "ok" | "retrying" | "overflow-fixed";
}

/** 爆版检测：在隐藏 iframe 中渲染 HTML，检查 body.scrollHeight */
function checkOverflow(html: string): Promise<boolean> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1280px;height:720px;border:none;visibility:hidden";
    iframe.sandbox.add("allow-same-origin");
    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc?.body) {
          const overflow = doc.body.scrollHeight > 725 || doc.body.scrollWidth > 1285;
          resolve(overflow);
        } else {
          resolve(false);
        }
      } catch {
        resolve(false);
      } finally {
        document.body.removeChild(iframe);
      }
    };

    iframe.onerror = () => {
      document.body.removeChild(iframe);
      resolve(false);
    };

    iframe.srcdoc = html;
  });
}

/** 强制注入 overflow:hidden 作为最终降级 */
function forceOverflowHidden(html: string): string {
  const injection = `<style>html,body{overflow:hidden!important;max-width:1280px!important;max-height:720px!important}</style>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${injection}</head>`);
  }
  return html.replace("<body", `${injection}<body`);
}

interface SlidePreviewProps {
  /** 从 SSE 流收到的幻灯片 HTML 列表，按 pageNumber 索引 */
  slides: Map<number, string>;
  /** 总页数 */
  totalPages: number;
  /** 是否还在生成中 */
  isGenerating: boolean;
  /** 大纲数据，用于爆版重试时提供页面信息 */
  pages?: Page[];
  /** 全局设计系统 */
  designSystem?: GlobalDesignSystem;
  /** LLM 配置，用于重试 API 调用 */
  llmConfig?: LLMConfig;
}

export default function SlidePreview({
  slides,
  totalPages,
  isGenerating,
  pages,
  designSystem,
  llmConfig,
}: SlidePreviewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [slideStates, setSlideStates] = useState<Map<number, SlideState>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const checkedRef = useRef<Set<number>>(new Set());

  // 当新幻灯片到达时，进行爆版检测和状态更新
  useEffect(() => {
    slides.forEach((html, pageNumber) => {
      if (checkedRef.current.has(pageNumber)) return;
      checkedRef.current.add(pageNumber);

      // 先立即展示
      setSlideStates((prev) => {
        const next = new Map(prev);
        next.set(pageNumber, { pageNumber, html, status: "ok" });
        return next;
      });

      // 后台检测爆版
      checkOverflow(html).then(async (isOverflow) => {
        if (!isOverflow) return;

        console.warn(`[SlidePreview] 第 ${pageNumber} 页检测到爆版，尝试重试`);
        setSlideStates((prev) => {
          const next = new Map(prev);
          const existing = next.get(pageNumber);
          if (existing) next.set(pageNumber, { ...existing, status: "retrying" });
          return next;
        });

        // 尝试通过 API 重新生成
        const page = pages?.find((p) => p.pageNumber === pageNumber);
        if (!page || !designSystem || !llmConfig) {
          // 无法重试，降级处理
          setSlideStates((prev) => {
            const next = new Map(prev);
            next.set(pageNumber, { pageNumber, html: forceOverflowHidden(html), status: "overflow-fixed" });
            return next;
          });
          return;
        }

        let retryHtml: string | null = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const res = await fetch("/api/generate-slide", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                page,
                designSystem,
                llmConfig,
                totalPages,
                retryHint: `第${attempt}次重试：内容超出 1280x720 区域，请大幅精简文字内容，减少要点数量。`,
              }),
            });
            if (!res.ok) continue;
            const data = await res.json();
            const newHtml = data.html;
            const stillOverflow = await checkOverflow(newHtml);
            if (!stillOverflow) {
              retryHtml = newHtml;
              break;
            }
          } catch {
            // 重试失败，继续
          }
        }

        setSlideStates((prev) => {
          const next = new Map(prev);
          if (retryHtml) {
            next.set(pageNumber, { pageNumber, html: retryHtml, status: "ok" });
          } else {
            next.set(pageNumber, { pageNumber, html: forceOverflowHidden(html), status: "overflow-fixed" });
          }
          return next;
        });
      });
    });
  }, [slides, pages, designSystem, llmConfig, totalPages]);

  // 自动跳转到最新生成的页面
  useEffect(() => {
    if (isGenerating && slideStates.size > 0) {
      const maxPage = Math.max(...slideStates.keys());
      setCurrentPage(maxPage);
    }
  }, [slideStates.size, isGenerating]);

  // 键盘翻页
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setCurrentPage((p) => Math.min(totalPages, p + 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [totalPages]);

  const currentSlide = slideStates.get(currentPage);
  const completedCount = slideStates.size;

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden" ref={containerRef}>
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800">
        <span className="text-xs text-gray-400">PPT 预览</span>
        <span className="text-xs text-gray-600">
          {isGenerating ? `${completedCount} / ${totalPages} 页已生成` : `共 ${totalPages} 页`}
        </span>
        {isGenerating && (
          <svg className="animate-spin w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="text-gray-400 hover:text-white disabled:opacity-30 p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </button>
          <span className="text-xs text-gray-300 min-w-[60px] text-center">{currentPage} / {totalPages}</span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="text-gray-400 hover:text-white disabled:opacity-30 p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>

      {/* 主预览区 */}
      <div className="flex items-center justify-center bg-gray-950 p-6" style={{ minHeight: 440 }}>
        {currentSlide ? (
          <div className="rounded-lg overflow-hidden shadow-2xl" style={{ width: 768, height: 432 }}>
            <iframe
              srcDoc={currentSlide.html}
              style={{ width: 1280, height: 720, transform: "scale(0.6)", transformOrigin: "top left", border: "none" }}
              sandbox="allow-same-origin"
              title={`Slide ${currentPage}`}
            />
          </div>
        ) : (
          <div className="text-gray-600 text-sm flex items-center gap-2">
            {isGenerating ? (
              <>
                <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                正在生成第 {currentPage} 页...
              </>
            ) : "该页尚未生成"}
          </div>
        )}
      </div>

      {/* 底部缩略图导航 */}
      <div className="flex gap-2 px-4 py-3 border-t border-gray-800 overflow-x-auto">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
          const slide = slideStates.get(pageNum);
          const isActive = pageNum === currentPage;
          return (
            <button
              key={pageNum}
              onClick={() => setCurrentPage(pageNum)}
              className={`flex-shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                isActive ? "border-blue-500" : "border-transparent hover:border-gray-600"
              }`}
              style={{ width: 96, height: 54 }}
            >
              {slide ? (
                <iframe
                  srcDoc={slide.html}
                  style={{ width: 1280, height: 720, transform: "scale(0.075)", transformOrigin: "top left", border: "none", pointerEvents: "none" }}
                  sandbox="allow-same-origin"
                  tabIndex={-1}
                  title={`Thumbnail ${pageNum}`}
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${isActive ? "bg-gray-700" : "bg-gray-800"}`}>
                  {isGenerating ? (
                    <svg className="animate-pulse w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/>
                    </svg>
                  ) : (
                    <span className="text-xs text-gray-600">{pageNum}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
