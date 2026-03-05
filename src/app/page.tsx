"use client";

import { useState, useRef, useEffect } from "react";
import InputPanel from "@/components/InputPanel";
import ProgressIndicator, { type ProgressState } from "@/components/ProgressIndicator";
import OutlineDisplay from "@/components/OutlineDisplay";
import SettingsPanel from "@/components/SettingsPanel";
import type { GenerateRequest, LLMConfig, SSEEvent } from "@/types/api";
import type { IntentAnalysis } from "@/types/intent";
import type { Storyline } from "@/types/storyline";
import type { PPTOutline, Page } from "@/types/outline";

type AppStatus = "idle" | "generating" | "done" | "error";

const INITIAL_PROGRESS: ProgressState = {
  intent: "waiting",
  storyline: "waiting",
  outline: "waiting",
};

const DEFAULT_CONFIG: LLMConfig = {
  apiKey: "",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  model: "qwen-max",
};

const STORAGE_KEY = "aippt_llm_config";

function loadConfig(): LLMConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_CONFIG;
}

function saveConfig(config: LLMConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export default function Home() {
  const [appStatus, setAppStatus] = useState<AppStatus>("idle");
  const [progress, setProgress] = useState<ProgressState>(INITIAL_PROGRESS);
  const [intent, setIntent] = useState<IntentAnalysis | undefined>();
  const [storyline, setStoryline] = useState<Storyline | undefined>();
  const [outline, setOutline] = useState<PPTOutline | undefined>();
  const [streamedPages, setStreamedPages] = useState<Page[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 从 localStorage 恢复配置
  useEffect(() => {
    setLlmConfig(loadConfig());
  }, []);

  const handleSaveConfig = (config: LLMConfig) => {
    setLlmConfig(config);
    saveConfig(config);
  };

  const resetState = () => {
    setProgress(INITIAL_PROGRESS);
    setIntent(undefined);
    setStoryline(undefined);
    setOutline(undefined);
    setStreamedPages([]);
    setErrorMessage("");
  };

  const handleGenerate = async (request: Omit<GenerateRequest, "llmConfig">) => {
    if (!llmConfig.apiKey) {
      setShowSettings(true);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    resetState();
    setAppStatus("generating");
    setProgress({ intent: "running", storyline: "waiting", outline: "waiting" });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, llmConfig }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "请求失败" }));
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const eventText of events) {
          if (!eventText.trim()) continue;
          const dataLine = eventText.split("\n").find((line) => line.startsWith("data:"));
          if (!dataLine) continue;
          const jsonStr = dataLine.slice("data:".length).trim();
          if (!jsonStr) continue;
          try {
            handleSSEEvent(JSON.parse(jsonStr) as SSEEvent);
          } catch {
            console.warn("无法解析 SSE 事件:", jsonStr);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "网络异常，请稍后重试";
      setErrorMessage(message);
      setAppStatus("error");
      setProgress((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next) as Array<keyof ProgressState>) {
          if (next[key] === "running") next[key] = "error";
        }
        return next;
      });
    }
  };

  const handleSSEEvent = (event: SSEEvent) => {
    switch (event.type) {
      case "status":
        setProgress((prev) => {
          const next = { ...prev };
          if (event.step === "intent") next.intent = "running";
          else if (event.step === "storyline") { next.intent = "done"; next.storyline = "running"; }
          else if (event.step === "outline") { next.intent = "done"; next.storyline = "done"; next.outline = "running"; }
          return next;
        });
        break;
      case "intent":
        setIntent(event.data);
        setProgress((prev) => ({ ...prev, intent: "done" }));
        break;
      case "storyline":
        setStoryline(event.data);
        setProgress((prev) => ({ ...prev, storyline: "done" }));
        break;
      case "page":
        setStreamedPages((prev) => [...prev, event.data]);
        break;
      case "outline":
        setOutline(event.data);
        setProgress((prev) => ({ ...prev, outline: "done" }));
        break;
      case "error":
        setErrorMessage(event.message);
        setAppStatus("error");
        setProgress((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(next) as Array<keyof ProgressState>) {
            if (next[key] === "running") next[key] = "error";
          }
          return next;
        });
        break;
      case "done":
        setAppStatus("done");
        break;
    }
  };

  const isGenerating = appStatus === "generating";
  const showProgress = appStatus !== "idle";
  const showResult = intent !== undefined;
  const isConfigured = !!llmConfig.apiKey;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-base font-bold text-gray-900">AIPPT 大纲生成器</h1>
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium">Beta</span>

          {/* 右侧：模型信息 + 设置按钮 */}
          <div className="ml-auto flex items-center gap-3">
            {isConfigured ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <span className="hidden sm:inline">{llmConfig.model}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>未配置 API Key</span>
              </div>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">模型设置</span>
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* 未配置提示 */}
        {!isConfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-amber-800 font-medium">请先配置 API Key</p>
              <p className="text-xs text-amber-600 mt-0.5">点击右上角「模型设置」填写你的 API Key 和模型信息</p>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs text-amber-700 underline hover:no-underline flex-shrink-0"
            >
              立即配置
            </button>
          </div>
        )}

        <InputPanel onGenerate={handleGenerate} isGenerating={isGenerating} />

        {showProgress && <ProgressIndicator progress={progress} />}

        {appStatus === "error" && errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-red-800 mb-1">生成失败</p>
                <p className="text-sm text-red-600">{errorMessage}</p>
                <p className="text-xs text-red-400 mt-2">
                  请检查 API Key 和模型配置是否正确
                  <button
                    onClick={() => setShowSettings(true)}
                    className="ml-2 underline hover:no-underline"
                  >
                    去检查设置
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {showResult && (
          <OutlineDisplay intent={intent} storyline={storyline} streamedPages={streamedPages} outline={outline} />
        )}

        {appStatus === "idle" && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">
              输入主题后点击「生成大纲」，AI 将通过三步分析为你生成专业 PPT 大纲
            </p>
            <p className="text-xs text-gray-300 mt-2">预计耗时 15-30 秒，请耐心等待</p>
          </div>
        )}
      </main>

      {/* 设置面板 */}
      {showSettings && (
        <SettingsPanel
          config={llmConfig}
          onSave={handleSaveConfig}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
