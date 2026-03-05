"use client";

/**
 * 单页大纲卡片组件
 * 展示单页 PPT 的所有信息：标题、创作思路、设计建议、内容要点、演讲备注
 */

import { useState } from "react";
import type { Page } from "@/types/outline";

/** 内容块类型对应的图标和颜色 */
const BLOCK_TYPE_CONFIG = {
  point: { icon: "•", color: "text-blue-600", bgColor: "bg-blue-50", label: "要点" },
  quote: { icon: "❝", color: "text-purple-600", bgColor: "bg-purple-50", label: "引用" },
  data: { icon: "📊", color: "text-green-600", bgColor: "bg-green-50", label: "数据" },
  imageSuggestion: { icon: "🖼", color: "text-orange-600", bgColor: "bg-orange-50", label: "配图" },
  chartSuggestion: { icon: "📈", color: "text-indigo-600", bgColor: "bg-indigo-50", label: "图表" },
} as const;

interface PageCardProps {
  page: Page;
}

export default function PageCard({ page }: PageCardProps) {
  // 创作思路和设计建议默认折叠
  const [showCreativeIntent, setShowCreativeIntent] = useState(false);
  const [showDesign, setShowDesign] = useState(false);
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* 卡片头部：页码 + 章节标签 + 标题 */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* 页码徽章 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
              {page.pageNumber}
            </span>
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
              {page.section}
            </span>
          </div>
        </div>

        {/* 页面标题 */}
        <h3 className="text-lg font-bold text-gray-900 leading-snug mb-2">
          {page.title}
        </h3>

        {/* 主标题 */}
        {page.content.headline && (
          <p className="text-sm text-gray-600 font-medium">
            {page.content.headline}
          </p>
        )}
        {/* 副标题 */}
        {page.content.subheadline && (
          <p className="text-sm text-gray-500 mt-1">
            {page.content.subheadline}
          </p>
        )}
      </div>

      {/* 内容块区域 */}
      {page.content.body.length > 0 && (
        <div className="px-5 pb-4">
          <div className="space-y-2">
            {page.content.body.map((block, idx) => {
              const config = BLOCK_TYPE_CONFIG[block.type] ?? BLOCK_TYPE_CONFIG.point;
              return (
                <div
                  key={idx}
                  className={`${config.bgColor} rounded-lg p-3`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`${config.color} text-sm mt-0.5 flex-shrink-0`}>
                      {config.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      {block.title && (
                        <p className={`text-xs font-semibold ${config.color} mb-0.5`}>
                          {block.title}
                        </p>
                      )}
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {block.detail}
                      </p>
                      {block.supportingData && (
                        <p className="text-xs text-gray-500 mt-1 italic">
                          {block.supportingData}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 折叠区域：创作思路 */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setShowCreativeIntent(!showCreativeIntent)}
          className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            创作思路
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${showCreativeIntent ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showCreativeIntent && (
          <div className="px-5 pb-4">
            <p className="text-sm text-gray-600 italic leading-relaxed">
              {page.creativeIntent}
            </p>
          </div>
        )}
      </div>

      {/* 折叠区域：设计建议 */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setShowDesign(!showDesign)}
          className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            设计建议
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${showDesign ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showDesign && (
          <div className="px-5 pb-4 space-y-2">
            {/* 布局类型 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">布局</span>
              <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium">
                {page.design.layout}
              </span>
              {page.design.colorTone && (
                <>
                  <span className="text-xs text-gray-400">色调</span>
                  <span className="text-xs px-2 py-0.5 bg-pink-50 text-pink-600 rounded-full font-medium">
                    {page.design.colorTone}
                  </span>
                </>
              )}
            </div>
            {/* 视觉元素 */}
            {page.design.visualElements.length > 0 && (
              <div>
                <span className="text-xs text-gray-400 block mb-1">视觉元素</span>
                <div className="flex flex-wrap gap-1.5">
                  {page.design.visualElements.map((element, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"
                    >
                      {element}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 折叠区域：演讲备注（仅在有内容时显示） */}
      {page.speakerNotes && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setShowSpeakerNotes(!showSpeakerNotes)}
            className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
          >
            <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              演讲备注
            </span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${showSpeakerNotes ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showSpeakerNotes && (
            <div className="px-5 pb-4">
              <p className="text-sm text-gray-600 leading-relaxed bg-yellow-50 rounded-lg p-3">
                {page.speakerNotes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 底部：过渡语（仅在有内容时显示） */}
      {page.transitionToNext && (
        <div className="border-t border-dashed border-gray-200 px-5 py-3">
          <p className="text-xs text-gray-400 italic flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            {page.transitionToNext}
          </p>
        </div>
      )}
    </div>
  );
}
