"use client";

import PageCard from "./PageCard";
import type { PPTOutline, Page } from "@/types/outline";
import type { IntentAnalysis } from "@/types/intent";
import type { Storyline } from "@/types/storyline";
import type { ResearchContext } from "@/types/api";

// ── OutlineMeta ──────────────────────────────────────────────

function OutlineMeta({
  intent,
  storyline,
  outline,
}: {
  intent?: IntentAnalysis;
  storyline?: Storyline;
  outline?: PPTOutline;
}) {
  const title = outline?.meta.title ?? "大纲生成中...";
  const purpose = outline?.meta.purpose ?? intent?.purpose ?? "-";
  const audience = outline?.meta.audience ?? intent?.audience ?? "-";
  const totalPages = outline?.meta.totalPages ?? storyline?.totalPages ?? intent?.pageCountSuggestion ?? "-";
  const globalStyle = outline?.meta.designSystem;

  return (
    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-blue-200 text-xs font-medium mb-1 uppercase tracking-wider">PPT 大纲</p>
          <h2 className="text-xl font-bold leading-tight mb-4">{title}</h2>
          <div className="flex flex-wrap gap-3">
            <div className="bg-white/20 rounded-lg px-3 py-2">
              <p className="text-blue-200 text-xs mb-0.5">用途</p>
              <p className="text-white text-sm font-medium">{purpose}</p>
            </div>
            <div className="bg-white/20 rounded-lg px-3 py-2">
              <p className="text-blue-200 text-xs mb-0.5">受众</p>
              <p className="text-white text-sm font-medium">{audience}</p>
            </div>
            <div className="bg-white/20 rounded-lg px-3 py-2">
              <p className="text-blue-200 text-xs mb-0.5">总页数</p>
              <p className="text-white text-sm font-medium">{totalPages} 页</p>
            </div>
            {intent?.styleHint && (
              <div className="bg-white/20 rounded-lg px-3 py-2">
                <p className="text-blue-200 text-xs mb-0.5">风格</p>
                <p className="text-white text-sm font-medium">{intent.styleHint}</p>
              </div>
            )}
          </div>
        </div>
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      </div>
      {globalStyle && (
        <div className="mt-4 pt-4 border-t border-white/20">
          <p className="text-blue-200 text-xs mb-2">全局视觉风格</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-white/15 rounded-md px-2 py-1.5">
              <span className="text-blue-200">风格基调：</span>
              <span className="text-white">{globalStyle.styleTone}</span>
            </div>
            <div className="bg-white/15 rounded-md px-2 py-1.5">
              <span className="text-blue-200">字体风格：</span>
              <span className="text-white">{globalStyle.typography}</span>
            </div>
            <div className="bg-white/15 rounded-md px-2 py-1.5 sm:col-span-2">
              <span className="text-blue-200">视觉风格：</span>
              <span className="text-white">{globalStyle.visualStyle}</span>
            </div>
            <div className="bg-white/15 rounded-md px-2 py-1.5 sm:col-span-2">
              <span className="text-blue-200">主色板：</span>
              <span className="text-white">{globalStyle.palette.join(" / ")}</span>
            </div>
          </div>
        </div>
      )}
      {intent?.coreMessage && (
        <div className="mt-4 pt-4 border-t border-white/20">
          <p className="text-blue-200 text-xs mb-1">核心信息</p>
          <p className="text-white text-sm leading-relaxed">"{intent.coreMessage}"</p>
        </div>
      )}
    </div>
  );
}

// ── StorylineView ────────────────────────────────────────────

function StorylineView({ storyline }: { storyline: Storyline }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 bg-blue-600 rounded-full" />
        <h3 className="text-base font-bold text-gray-900">故事线</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">叙事框架</p>
          <p className="text-sm font-semibold text-gray-800">{storyline.narrativeFramework}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">情感曲线</p>
          <p className="text-sm text-gray-700">{storyline.emotionalCurve}</p>
        </div>
      </div>
      <div className="bg-blue-50 rounded-xl p-4 mb-5">
        <p className="text-xs text-blue-400 mb-1">核心信息</p>
        <p className="text-sm font-medium text-blue-800">"{storyline.coreMessage}"</p>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-3">章节结构</p>
        <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
          {storyline.sections.map((section, index) => (
            <div key={index} className="flex items-center flex-shrink-0">
              <div className="bg-white border border-gray-200 rounded-xl p-3 min-w-[140px] max-w-[180px]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-xs text-gray-400">P{section.pageRange[0]}-{section.pageRange[1]}</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-1">{section.title}</p>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{section.keyMessage}</p>
              </div>
              {index < storyline.sections.length - 1 && (
                <div className="flex items-center px-2 flex-shrink-0">
                  <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 联网检索结果卡片 ─────────────────────────────────────────

function ResearchSourcesCard({ research }: { research: ResearchContext }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 bg-green-600 rounded-full" />
        <h3 className="text-base font-bold text-gray-900">联网检索</h3>
        <span className="text-xs text-gray-400">{research.sources.length} 个来源</span>
      </div>

      {/* 关键发现 */}
      {research.keyFindings.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">关键发现</p>
          <ul className="space-y-1.5">
            {research.keyFindings.map((finding, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>
                {finding}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 来源列表 */}
      {research.sources.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">参考来源</p>
          <div className="space-y-2">
            {research.sources.map((source, i) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors group"
              >
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700 truncate">{source.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{source.snippet}</p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 页面加载占位动画 ─────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-7 h-7 bg-gray-200 rounded-lg" />
        <div className="h-4 bg-gray-200 rounded w-1/3" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-4/5" />
        <div className="h-3 bg-gray-100 rounded w-3/5" />
      </div>
    </div>
  );
}

// ── OutlineDisplay（对外导出）────────────────────────────────

interface OutlineDisplayProps {
  intent?: IntentAnalysis;
  storyline?: Storyline;
  /** 流式逐页推入的页面（M4 生成过程中实时更新） */
  streamedPages?: Page[];
  /** 最终完整大纲（M4 全部完成后） */
  outline?: PPTOutline;
  /** M2 联网检索结果 */
  researchContext?: ResearchContext;
}

export default function OutlineDisplay({
  intent,
  storyline,
  streamedPages = [],
  outline,
  researchContext,
}: OutlineDisplayProps) {
  if (!intent) return null;

  // 优先用最终校验过的 outline.pages，否则用流式累积的 streamedPages
  const pagesToShow = outline?.pages ?? streamedPages;
  const totalExpected = outline?.meta.totalPages ?? storyline?.totalPages ?? intent.pageCountSuggestion ?? 0;
  const isStreaming = !outline && streamedPages.length > 0;

  return (
    <div className="space-y-5">
      <OutlineMeta intent={intent} storyline={storyline} outline={outline} />

      {storyline && <StorylineView storyline={storyline} />}

      {researchContext && <ResearchSourcesCard research={researchContext} />}

      {/* 页面列表：有任意页面就开始展示 */}
      {pagesToShow.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-blue-600 rounded-full" />
            <h3 className="text-base font-bold text-gray-900">逐页大纲</h3>
            <span className="text-sm text-gray-400">
              {isStreaming
                ? `${pagesToShow.length} / ${totalExpected} 页`
                : `共 ${pagesToShow.length} 页`}
            </span>
            {isStreaming && (
              <span className="flex items-center gap-1 text-xs text-blue-500">
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                生成中
              </span>
            )}
          </div>

          <div className="space-y-4">
            {pagesToShow.map((page) => (
              <PageCard key={page.pageNumber} page={page} />
            ))}

            {/* 流式进行中：显示剩余页的骨架屏 */}
            {isStreaming && totalExpected > pagesToShow.length && (
              Array.from({ length: Math.min(2, totalExpected - pagesToShow.length) }).map((_, i) => (
                <PageSkeleton key={`skeleton-${i}`} />
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}
