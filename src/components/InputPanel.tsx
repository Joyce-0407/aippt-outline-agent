"use client";

/**
 * 用户输入面板组件
 * 包含：文本输入框、可选参数（折叠面板）、生成按钮
 */

import { useState } from "react";
import type { GenerateRequest } from "@/types/api";

/** InputPanel 对外暴露的请求类型（不含 llmConfig，由页面层注入） */
type InputRequest = Omit<GenerateRequest, "llmConfig">;

/** 示例主题列表，帮助用户快速体验 */
const EXAMPLE_TOPICS = [
  "帮我做一个关于 AI 在教育中应用的 PPT",
  "Q1 销售业绩汇报，重点分析增长亮点和下季度策略",
  "新产品发布方案，面向科技爱好者群体",
  "数字化转型战略规划，给公司高层汇报",
  "Python 编程入门课件，面向零基础学员",
];

/** 用途选项 */
const PURPOSE_OPTIONS = [
  "工作汇报",
  "商业提案",
  "教学课件",
  "演讲分享",
  "产品介绍",
  "项目总结",
  "竞品分析",
  "培训材料",
  "其他",
];

interface InputPanelProps {
  /** 点击生成时的回调 */
  onGenerate: (request: InputRequest) => void;
  /** 是否正在生成中 */
  isGenerating: boolean;
}

export default function InputPanel({ onGenerate, isGenerating }: InputPanelProps) {
  // 主输入框内容
  const [userInput, setUserInput] = useState("");
  // 可选参数是否展开
  const [showAdvanced, setShowAdvanced] = useState(false);
  // 可选参数值
  const [pageCount, setPageCount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [audience, setAudience] = useState("");
  // 前端校验错误信息
  const [error, setError] = useState("");

  /** 点击生成按钮 */
  const handleSubmit = () => {
    // 前端校验
    if (!userInput.trim()) {
      setError("请输入 PPT 主题或描述内容");
      return;
    }
    if (userInput.length > 5000) {
      setError("输入内容不能超过 5000 字符");
      return;
    }

    setError("");

    // 构造请求对象
    const request: InputRequest = {
      userInput: userInput.trim(),
    };
    if (pageCount && !isNaN(Number(pageCount))) {
      request.pageCount = Number(pageCount);
    }
    if (purpose) request.purpose = purpose;
    if (audience.trim()) request.audience = audience.trim();

    onGenerate(request);
  };

  /** 点击示例主题 */
  const handleExampleClick = (topic: string) => {
    setUserInput(topic);
    setError("");
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      {/* 主输入框 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          描述你的 PPT 主题
          <span className="text-red-500 ml-1">*</span>
        </label>
        <textarea
          value={userInput}
          onChange={(e) => {
            setUserInput(e.target.value);
            if (error) setError("");
          }}
          disabled={isGenerating}
          placeholder="请描述你的 PPT 主题，越详细越好。例如：帮我做一个关于公司 2025 年 Q1 销售业绩的汇报 PPT，面向公司高层，需要重点展示增长数据和下季度策略..."
          className="w-full min-h-[120px] p-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y disabled:bg-gray-50 disabled:cursor-not-allowed"
          maxLength={5000}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-red-500">{error}</span>
          <span className={`text-xs ${userInput.length > 4500 ? "text-red-500" : "text-gray-400"}`}>
            {userInput.length}/5000
          </span>
        </div>
      </div>

      {/* 示例主题 */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">试试这些示例：</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() => handleExampleClick(topic)}
              disabled={isGenerating}
              className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {topic.length > 20 ? topic.slice(0, 20) + "..." : topic}
            </button>
          ))}
        </div>
      </div>

      {/* 高级选项（默认折叠） */}
      <div className="mb-5">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          disabled={isGenerating}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          高级选项（可选）
        </button>

        {showAdvanced && (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 页数 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                期望页数
              </label>
              <input
                type="number"
                value={pageCount}
                onChange={(e) => setPageCount(e.target.value)}
                disabled={isGenerating}
                placeholder="5-30"
                min={5}
                max={30}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">不填则 AI 自动推荐</p>
            </div>

            {/* 用途 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                PPT 用途
              </label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                disabled={isGenerating}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed bg-white"
              >
                <option value="">AI 自动判断</option>
                {PURPOSE_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* 受众 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                目标受众
              </label>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                disabled={isGenerating}
                placeholder="如：公司高层、投资人"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        )}
      </div>

      {/* 生成按钮 */}
      <button
        onClick={handleSubmit}
        disabled={isGenerating || !userInput.trim()}
        className="w-full py-3 px-6 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            {/* 旋转加载图标 */}
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            生成中...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            生成大纲
          </>
        )}
      </button>
    </div>
  );
}
