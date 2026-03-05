/**
 * API 请求/响应和 SSE 事件的类型定义
 */

import { IntentAnalysis } from "./intent";
import { Storyline } from "./storyline";
import { PPTOutline } from "./outline";

/** LLM 配置，由前端用户填写后随请求传入 */
export interface LLMConfig {
  /** API Key */
  apiKey: string;
  /** API Base URL */
  baseUrl: string;
  /** 模型名称，例如 qwen-max */
  model: string;
}

/** 大纲生成请求体 */
export interface GenerateRequest {
  /** 用户输入的文字内容，必填，1-5000 字符 */
  userInput: string;
  /** 可选：用户期望的页数，不传则由 Agent 自动推荐 */
  pageCount?: number;
  /** 可选：用户指定的 PPT 用途 */
  purpose?: string;
  /** 可选：目标受众 */
  audience?: string;
  /** LLM 配置，从前端设置面板传入 */
  llmConfig: LLMConfig;
}

/** SSE 进度状态步骤 */
export type SSEStep = "intent" | "storyline" | "outline";

/** SSE 事件类型联合体 */
export type SSEEvent =
  | {
      /** 进度状态事件：通知当前正在执行哪一步 */
      type: "status";
      step: SSEStep;
      message: string;
    }
  | {
      /** M1 意图分析完成事件 */
      type: "intent";
      data: IntentAnalysis;
    }
  | {
      /** M3 故事线构建完成事件 */
      type: "storyline";
      data: Storyline;
    }
  | {
      /** M4 流式输出：单页大纲就绪事件（生成多少推多少） */
      type: "page";
      data: import("./outline").Page;
      index: number;
    }
  | {
      /** M4 全部页面生成完成，推送最终校验过的完整大纲 */
      type: "outline";
      data: PPTOutline;
    }
  | {
      /** 错误事件 */
      type: "error";
      message: string;
      code: ErrorCode;
    }
  | {
      /** 全流程完成事件 */
      type: "done";
    };

/** 错误码枚举 */
export type ErrorCode =
  | "INVALID_INPUT"   // 请求参数不合法
  | "LLM_ERROR"       // LLM 调用失败
  | "LLM_PARSE_ERROR" // LLM 返回的 JSON 解析失败
  | "RATE_LIMIT"      // 调用频率超限
  | "INTERNAL_ERROR"; // 服务内部错误

/** HTTP 400 错误响应 */
export interface ErrorResponse {
  error: string;
  code: ErrorCode;
}
