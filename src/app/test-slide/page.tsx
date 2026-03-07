"use client";

import { useState, useEffect } from "react";

interface SampleBlock {
  type: "point" | "data" | "chartSuggestion" | "imageSuggestion" | "quote";
  title?: string;
  detail: string;
  supportingData?: string;
}

interface SamplePage {
  pageNumber: number;
  section: string;
  title: string;
  creativeIntent: string;
  design: { layout: string; visualElements: string[] };
  content: { headline: string; subheadline?: string; body: SampleBlock[] };
}

/** 三个不同风格的样例页面，用于验证 LLM 生成 HTML 的效果 */
const SAMPLE_DESIGN_SYSTEM = {
  styleTone: "科技简约",
  palette: ["#1E40AF", "#3B82F6", "#DBEAFE", "#F8FAFC", "#0F172A"],
  typography: "无衬线现代体，标题加粗，正文常规",
  visualStyle: "线性图标 + 扁平色块 + 微渐变",
};

const SAMPLE_PAGES: SamplePage[] = [
  {
    pageNumber: 1,
    section: "开篇",
    title: "封面",
    creativeIntent: "以简洁有力的视觉冲击开场，奠定科技感基调，让观众一眼抓住主题",
    design: {
      layout: "全屏标题页",
      visualElements: ["大面积深蓝渐变背景", "抽象科技线条装饰", "底部放置日期和演讲者信息"],
    },
    content: {
      headline: "AI 重塑教育的未来",
      subheadline: "从个性化学习到智能评估——人工智能如何变革传统教育模式",
      body: [
        { type: "point" as const, detail: "2026 年度教育科技战略报告" },
        { type: "point" as const, detail: "演讲人：张明 | 教育科技事业部" },
      ],
    },
  },
  {
    pageNumber: 4,
    section: "核心方案",
    title: "三大核心产品",
    creativeIntent: "用三栏并列的方式清晰呈现三个核心产品，让受众一目了然地对比和理解",
    design: {
      layout: "三栏并列",
      visualElements: ["每栏顶部放置产品图标", "底部用浅蓝色卡片承载内容", "栏间用细线分隔"],
    },
    content: {
      headline: "三大 AI 教育产品矩阵",
      subheadline: "覆盖教、学、评全链路",
      body: [
        { type: "point" as const, title: "智能备课助手", detail: "基于知识图谱自动生成教案，节省教师 60% 备课时间，支持多学科多版本教材" },
        { type: "point" as const, title: "自适应学习引擎", detail: "实时追踪学生知识掌握度，动态调整学习路径，实现千人千面的个性化学习体验" },
        { type: "point" as const, title: "AI 评估系统", detail: "自动批改主观题，生成多维度学情报告，帮助教师精准定位每个学生的薄弱环节" },
      ],
    },
  },
  {
    pageNumber: 7,
    section: "数据验证",
    title: "实证数据",
    creativeIntent: "用震撼的数据说话，让受众直观感受到 AI 教育的实际效果，增强说服力",
    design: {
      layout: "数据图表+解读",
      visualElements: ["左侧放置柱状图展示试点学校成绩提升", "右侧用大字号突出关键数据", "底部添加数据来源说明"],
    },
    content: {
      headline: "试点成果：数据说话",
      body: [
        { type: "data" as const, title: "平均成绩提升", detail: "试点学校学生平均成绩提升 23%", supportingData: "23%（示意数据）" },
        { type: "data" as const, title: "教师效率", detail: "备课时间减少 60%，教学满意度提升至 92%", supportingData: "60% / 92%（示意数据）" },
        { type: "chartSuggestion" as const, detail: "柱状图：展示 6 所试点学校实施前后的平均分对比，X轴为学校名称，Y轴为平均分" },
        { type: "point" as const, detail: "数据来源：2025年秋季学期试点项目跟踪报告，覆盖 6 所学校、1.2 万名学生" },
      ],
    },
  },
];

const STORAGE_KEY = "aippt_llm_config";

function loadConfig() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export default function TestSlidePage() {
  const [llmConfig, setLlmConfig] = useState<{ apiKey: string; baseUrl: string; model: string } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setLlmConfig(loadConfig());
  }, []);

  const generate = async () => {
    if (!llmConfig?.apiKey) {
      setError("请先在首页设置 API Key");
      return;
    }
    setLoading(true);
    setError("");
    setHtml("");
    const start = Date.now();

    try {
      const res = await fetch("/api/test-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: SAMPLE_PAGES[selectedIndex],
          designSystem: SAMPLE_DESIGN_SYSTEM,
          llmConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHtml(data.html);
      setElapsed(Date.now() - start);
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  const page = SAMPLE_PAGES[selectedIndex];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 顶部工具栏 */}
      <div className="border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <h1 className="text-sm font-bold text-gray-300">PPT HTML 生成验证</h1>
        <div className="flex gap-2 ml-4">
          {SAMPLE_PAGES.map((p, i) => (
            <button
              key={i}
              onClick={() => { setSelectedIndex(i); setHtml(""); }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                i === selectedIndex
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              P{p.pageNumber} · {p.title}
            </button>
          ))}
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="ml-auto px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              生成中...
            </>
          ) : "生成 HTML"}
        </button>
        {elapsed > 0 && <span className="text-xs text-gray-500">{(elapsed / 1000).toFixed(1)}s</span>}
      </div>

      <div className="flex" style={{ height: "calc(100vh - 49px)" }}>
        {/* 左侧：输入数据 */}
        <div className="w-[360px] flex-shrink-0 border-r border-gray-800 overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="text-xs text-gray-500 mb-2">设计系统</h3>
            <div className="bg-gray-900 rounded-lg p-3 text-xs space-y-1.5">
              <p><span className="text-gray-500">风格：</span>{SAMPLE_DESIGN_SYSTEM.styleTone}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">色板：</span>
                {SAMPLE_DESIGN_SYSTEM.palette.map((c) => (
                  <div key={c} className="w-4 h-4 rounded" style={{ backgroundColor: c }} title={c} />
                ))}
              </div>
              <p><span className="text-gray-500">字体：</span>{SAMPLE_DESIGN_SYSTEM.typography}</p>
              <p><span className="text-gray-500">视觉：</span>{SAMPLE_DESIGN_SYSTEM.visualStyle}</p>
            </div>
          </div>

          <div>
            <h3 className="text-xs text-gray-500 mb-2">页面数据（P{page.pageNumber}）</h3>
            <div className="bg-gray-900 rounded-lg p-3 text-xs space-y-2">
              <p><span className="text-gray-500">标题：</span>{page.title}</p>
              <p><span className="text-gray-500">创作思路：</span><span className="text-gray-300">{page.creativeIntent}</span></p>
              <p><span className="text-gray-500">布局：</span>{page.design.layout}</p>
              <p><span className="text-gray-500">视觉元素：</span></p>
              <ul className="pl-3 space-y-0.5">
                {page.design.visualElements.map((v, i) => (
                  <li key={i} className="text-gray-400">· {v}</li>
                ))}
              </ul>
              <p><span className="text-gray-500">主标题：</span>{page.content.headline}</p>
              {page.content.subheadline && <p><span className="text-gray-500">副标题：</span>{page.content.subheadline}</p>}
              <p className="text-gray-500">内容块：</p>
              {page.content.body.map((b, i) => (
                <div key={i} className="pl-3 text-gray-400">
                  <span className="text-gray-600">[{b.type}]</span> {b.title && <span className="text-gray-300">{b.title}：</span>}{b.detail}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：预览区 */}
        <div className="flex-1 flex items-center justify-center bg-gray-900 p-8">
          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}
          {!html && !loading && !error && (
            <div className="text-gray-600 text-sm">点击「生成 HTML」查看效果</div>
          )}
          {loading && (
            <div className="text-gray-500 text-sm flex items-center gap-2">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              LLM 正在生成 HTML...
            </div>
          )}
          {html && (
            <div
              className="rounded-lg overflow-hidden shadow-2xl"
              style={{ width: 960, height: 540 }}
            >
              <iframe
                srcDoc={html}
                style={{ width: 1280, height: 720, transform: "scale(0.75)", transformOrigin: "top left", border: "none" }}
                sandbox="allow-same-origin"
                title="PPT Preview"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
