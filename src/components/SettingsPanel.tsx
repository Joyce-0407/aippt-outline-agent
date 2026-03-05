"use client";

/**
 * LLM 设置面板
 * 支持配置 API Key、Base URL、模型选择
 * 设置自动保存到 localStorage
 */

import { useState } from "react";
import type { LLMConfig } from "@/types/api";

/** 预设的 API 提供商 */
const PROVIDERS = [
  {
    name: "阿里云百炼",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-max", "qwen-plus", "qwen-turbo", "qwen-long"],
  },
  {
    name: "Kimi (Moonshot)",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k", "kimi-k2-5"],
  },
  {
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4", "glm-4-flash", "glm-z1-flash"],
  },
  {
    name: "自定义",
    baseUrl: "",
    models: [],
  },
];

interface SettingsPanelProps {
  config: LLMConfig;
  onSave: (config: LLMConfig) => void;
  onClose: () => void;
}

export default function SettingsPanel({ config, onSave, onClose }: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [model, setModel] = useState(config.model);
  const [showApiKey, setShowApiKey] = useState(false);
  const [customModel, setCustomModel] = useState("");
  const [useCustomModel, setUseCustomModel] = useState(false);

  // 根据当前 baseUrl 匹配提供商
  const currentProvider =
    PROVIDERS.find((p) => p.baseUrl === baseUrl) ?? PROVIDERS[PROVIDERS.length - 1];
  const isCustomProvider = currentProvider.name === "自定义";

  // 当前提供商的可用模型列表
  const availableModels = currentProvider.models;

  const handleProviderChange = (providerName: string) => {
    const provider = PROVIDERS.find((p) => p.name === providerName);
    if (!provider) return;
    setBaseUrl(provider.baseUrl);
    setUseCustomModel(false);
    if (provider.models.length > 0) {
      setModel(provider.models[0]);
    } else {
      setModel("");
    }
  };

  const handleModelSelectChange = (value: string) => {
    if (value === "__custom__") {
      setUseCustomModel(true);
      setCustomModel(model); // 把当前 model 带入自定义输入框
    } else {
      setUseCustomModel(false);
      setModel(value);
    }
  };

  const handleSave = () => {
    const finalModel = useCustomModel ? customModel.trim() || model : model;
    onSave({ apiKey, baseUrl, model: finalModel });
    onClose();
  };

  const isValid = apiKey.trim() && baseUrl.trim() && model.trim();

  return (
    // 遮罩层
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900">模型设置</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 表单内容 */}
        <div className="px-6 py-5 space-y-5">
          {/* API 提供商 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">API 提供商</label>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => handleProviderChange(p.name)}
                  className={`px-3 py-2 text-sm rounded-lg border text-left transition-colors ${
                    currentProvider.name === p.name
                      ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Base URL（自定义模式下可编辑） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={!isCustomProvider}
              placeholder="https://your-api-endpoint/v1"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 font-mono"
            />
            {!isCustomProvider && (
              <p className="text-xs text-gray-400 mt-1">选择「自定义」可修改 Base URL</p>
            )}
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              API Key
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">API Key 仅在本地使用，不会上传到任何服务器</p>
          </div>

          {/* 模型选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              模型
              <span className="text-red-500 ml-1">*</span>
            </label>
            {availableModels.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={useCustomModel ? "__custom__" : model}
                  onChange={(e) => handleModelSelectChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="__custom__">自定义模型名称...</option>
                </select>
                {useCustomModel && (
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="输入自定义模型名称，例如 qwen-max-2025-01-25"
                    autoFocus
                    className="w-full px-3 py-2 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                )}
              </div>
            ) : (
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="输入模型名称，例如 gpt-4o"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
