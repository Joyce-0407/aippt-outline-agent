# AIPPT 大纲生成 Agent -- 技术架构文档（Phase 1 MVP）

> 版本：v1.0 | 日期：2026-03-04
> 基于产品设计文档 `agent-design.md` 编写

---

## 一、需求理解

### 1.1 核心目标

Phase 1 实现最小可用链路：用户在 Web 界面输入一段文字描述或主题，系统通过 3 次 LLM 调用（意图分析 -> 故事线构建 -> 大纲生成），输出结构化的 PPT 大纲并在前端展示。

### 1.2 Phase 1 明确边界

**做**：
- 纯文本输入（主题 / 描述文字）
- M1 意图分析（判断用途、受众、场景，默认走场景 B 主题扩写模式）
- M3 故事线构建（选叙事框架、规划章节）
- M4 大纲细化生成（逐页输出完整内容）
- 简单 Web 界面用于验证效果

**不做**：
- 文档上传解析（M0）
- 联网搜索（M2）
- 质量审查（M5）
- 追问交互（M1 的追问分支暂缓，信息不足时用默认值补全）

### 1.3 技术约束

| 约束项 | 具体要求 |
|--------|----------|
| LLM | 阿里云百炼 API，模型使用 Qwen-Max |
| 后端语言 | TypeScript / Node.js |
| 前端 | 轻量 Web 界面，能验证大纲生成效果即可 |
| 禁用 | 不使用 Anthropic Claude API |

---

## 二、整体技术架构

### 2.1 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                     前端（Next.js）                       │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │ 输入面板  │  │  进度状态展示  │  │  大纲结果展示    │  │
│  └────┬─────┘  └───────┬───────┘  └────────┬─────────┘  │
│       │                │                    │            │
└───────┼────────────────┼────────────────────┼────────────┘
        │  HTTP POST     │  SSE 推送          │  SSE 推送
        ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                   后端 API 层（Next.js API Routes）       │
│  ┌──────────────────────────────────────────────────┐   │
│  │  POST /api/generate    -- 接收用户输入，触发生成  │   │
│  │  (返回 SSE 流式响应)                              │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │              Agent 编排器 (Orchestrator)           │   │
│  │                                                    │   │
│  │  Step 1: M1 意图分析                               │   │
│  │      │                                             │   │
│  │      ▼                                             │   │
│  │  Step 2: M3 故事线构建                             │   │
│  │      │                                             │   │
│  │      ▼                                             │   │
│  │  Step 3: M4 大纲细化生成                           │   │
│  │      │                                             │   │
│  │      ▼                                             │   │
│  │  输出完整 PPTOutline                               │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │              LLM 服务层 (LLMClient)               │   │
│  │  封装阿里云百炼 API 调用逻辑                       │   │
│  │  - 请求构建 / 响应解析 / 重试 / 错误处理           │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                               │
└─────────────────────────┼───────────────────────────────┘
                          │  HTTPS
                          ▼
              ┌───────────────────────┐
              │   阿里云百炼 API       │
              │   (Qwen-Max)          │
              └───────────────────────┘
```

### 2.2 关键设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 全栈框架 | Next.js (App Router) | 前后端同一个项目，Phase 1 开发效率最高；API Routes 直接充当后端 |
| 通信方式 | SSE (Server-Sent Events) | 3 次 LLM 调用耗时较长（预计 15-30s），需要流式推送进度；比 WebSocket 轻量 |
| LLM 输出 | 强制 JSON 格式 | 使用 System Prompt 约束 + Zod Schema 校验，确保输出可解析 |
| 状态管理 | 无持久化存储 | Phase 1 不需要数据库，生成结果仅在前端内存中展示 |
| 部署 | 本地开发为主 | Phase 1 验证阶段，`npm run dev` 即可运行 |

---

## 三、项目目录结构

```
aippt/
├── package.json
├── tsconfig.json
├── next.config.ts
├── .env.local                          # 环境变量（百炼 API Key 等）
├── .env.example                        # 环境变量示例
├── .gitignore
│
├── src/
│   ├── app/                            # Next.js App Router
│   │   ├── layout.tsx                  # 全局布局
│   │   ├── page.tsx                    # 首页（输入界面）
│   │   ├── globals.css                 # 全局样式
│   │   └── api/
│   │       └── generate/
│   │           └── route.ts            # POST /api/generate  SSE 接口
│   │
│   ├── components/                     # 前端组件
│   │   ├── InputPanel.tsx              # 用户输入面板
│   │   ├── GenerateButton.tsx          # 生成按钮（含加载状态）
│   │   ├── ProgressIndicator.tsx       # 生成进度指示器
│   │   ├── OutlineViewer.tsx           # 大纲结果展示（主组件）
│   │   ├── OutlineMeta.tsx             # 大纲元信息展示
│   │   ├── StorylineView.tsx           # 故事线展示
│   │   └── PageCard.tsx                # 单页大纲卡片
│   │
│   ├── agent/                          # Agent 核心逻辑
│   │   ├── orchestrator.ts             # 主流程编排器
│   │   ├── modules/
│   │   │   ├── m1-intent-analyzer.ts   # M1 意图分析模块
│   │   │   ├── m3-storyline-builder.ts # M3 故事线构建模块
│   │   │   └── m4-outline-generator.ts # M4 大纲细化生成模块
│   │   └── prompts/
│   │       ├── system.ts               # 全局 System Prompt
│   │       ├── m1-intent.ts            # M1 意图分析 Prompt
│   │       ├── m3-storyline.ts         # M3 故事线构建 Prompt
│   │       └── m4-outline.ts           # M4 大纲生成 Prompt
│   │
│   ├── lib/                            # 通用工具库
│   │   ├── llm-client.ts              # 阿里云百炼 API 客户端封装
│   │   └── validators.ts              # Zod Schema 校验器
│   │
│   └── types/                          # TypeScript 类型定义
│       ├── outline.ts                  # PPTOutline / Page / Section 等核心类型
│       ├── intent.ts                   # 意图分析结果类型
│       ├── storyline.ts                # 故事线类型
│       └── api.ts                      # API 请求/响应/SSE 事件类型
│
├── docs/
│   ├── agent-design.md                 # 产品设计文档
│   └── architecture.md                 # 本文档
│
└── tests/                              # 测试（Phase 1 以手动测试为主，关键逻辑写单测）
    ├── agent/
    │   └── orchestrator.test.ts
    └── lib/
        └── llm-client.test.ts
```

---

## 四、技术选型说明

### 4.1 后端技术栈

| 技术 | 版本建议 | 选型理由 |
|------|----------|----------|
| **Next.js** | 15.x (App Router) | 前后端一体化，API Routes 即后端；Phase 1 无需单独部署后端服务；SSR/SSG 可在后续优化 SEO |
| **TypeScript** | 5.x | 项目要求；类型安全对结构化数据处理至关重要 |
| **Zod** | 3.x | LLM 输出的 JSON 校验；与 TypeScript 类型推导深度集成；比 JSON Schema 写起来更简洁 |
| **openai** (npm 包) | 4.x | 阿里云百炼 API 兼容 OpenAI SDK 协议，可直接复用此 SDK，设置 baseURL 指向百炼即可 |

**为什么用 `openai` SDK 而不是自己封装 HTTP 调用?**

阿里云百炼 API 完全兼容 OpenAI Chat Completions 协议。使用官方 `openai` npm 包，只需修改 `baseURL` 和 `apiKey`，即可获得：
- 完整的 TypeScript 类型支持
- 内置的重试和错误处理
- 流式响应支持
- 社区成熟度高，文档丰富

### 4.2 前端技术栈

| 技术 | 选型理由 |
|------|----------|
| **React** (Next.js 内置) | 组件化开发，生态成熟 |
| **Tailwind CSS** | 快速出界面，不需要写 CSS 文件；Phase 1 重功能验证不重视觉设计 |
| **Lucide React** | 轻量图标库，按需引入 |

**不引入的技术（Phase 1 保持简单）**：
- 不用 shadcn/ui -- 组件不多，手写更快
- 不用状态管理库 -- 单页面应用，React useState 足够
- 不用 CSS-in-JS -- Tailwind 够用

### 4.3 开发工具链

| 工具 | 用途 |
|------|------|
| **pnpm** | 包管理器（比 npm 更快，磁盘占用更小） |
| **ESLint** | 代码规范（Next.js 内置配置） |
| **Prettier** | 代码格式化 |
| **dotenv** | 环境变量管理（Next.js 内置支持 `.env.local`） |

---

## 五、数据流设计

### 5.1 完整数据流

```
用户在前端输入框输入文字
         │
         ▼
[前端] 构造请求体 { userInput: string }
         │
         │  POST /api/generate
         ▼
[API Route] 接收请求，创建 SSE 流
         │
         │  推送事件: { type: "status", step: "intent", message: "正在分析你的需求..." }
         ▼
[Orchestrator] 调用 M1 意图分析
         │
         │  构造 Prompt -> 调用百炼 API (Qwen-Max) -> 解析 JSON 响应 -> Zod 校验
         ▼
IntentAnalysis {
  purpose: "商业提案",
  audience: "投资人",
  scenarioType: "B",
  pageCountSuggestion: 15,
  styleHint: "正式严谨",
  topicKeywords: ["AI", "教育", "应用"],
  coreProblem: "如何将AI有效应用于教育领域"
}
         │
         │  推送事件: { type: "intent", data: IntentAnalysis }
         │  推送事件: { type: "status", step: "storyline", message: "正在构建故事线..." }
         ▼
[Orchestrator] 调用 M3 故事线构建
         │
         │  输入：用户原文 + IntentAnalysis
         │  构造 Prompt -> 调用百炼 API -> 解析 -> 校验
         ▼
Storyline {
  narrativeFramework: "方案提案型",
  coreMessage: "AI 正在重塑教育的每一个环节",
  emotionalCurve: "引发好奇 -> 展示机会 -> 呈现方案 -> 坚定信心",
  sections: [
    { title: "行业变革", purpose: "引起关注", pageRange: [1, 3], keyMessage: "..." },
    { title: "核心方案", purpose: "展示价值", pageRange: [4, 8], keyMessage: "..." },
    ...
  ],
  totalPages: 15
}
         │
         │  推送事件: { type: "storyline", data: Storyline }
         │  推送事件: { type: "status", step: "outline", message: "正在生成详细大纲..." }
         ▼
[Orchestrator] 调用 M4 大纲细化生成
         │
         │  输入：用户原文 + IntentAnalysis + Storyline
         │  构造 Prompt -> 调用百炼 API -> 解析 -> 校验
         ▼
PPTOutline {
  meta: { title, purpose, audience, totalPages, scenarioType },
  storyline: { narrativeFramework, coreMessage, emotionalCurve, sections },
  pages: [
    { pageNumber: 1, section: "行业变革", title: "...", content: {...}, design: {...}, ... },
    { pageNumber: 2, ... },
    ...
  ]
}
         │
         │  推送事件: { type: "outline", data: PPTOutline }
         │  推送事件: { type: "done" }
         ▼
[前端] 逐步接收 SSE 事件，更新 UI：
  1. 收到 status 事件 -> 更新进度指示器
  2. 收到 intent 事件  -> 可选展示分析结果
  3. 收到 storyline 事件 -> 展示故事线概览
  4. 收到 outline 事件  -> 渲染完整大纲
  5. 收到 done 事件    -> 标记生成完成
```

### 5.2 SSE 事件类型定义

```typescript
// SSE 事件类型
type SSEEvent =
  | { type: "status"; step: "intent" | "storyline" | "outline"; message: string }
  | { type: "intent"; data: IntentAnalysis }
  | { type: "storyline"; data: Storyline }
  | { type: "outline"; data: PPTOutline }
  | { type: "error"; message: string; code: string }
  | { type: "done" };
```

### 5.3 错误处理流

```
LLM 调用失败
    │
    ├── 网络错误 / 超时 -> 自动重试 1 次 -> 仍失败 -> 推送 error 事件
    ├── API Key 无效   -> 直接推送 error 事件（不重试）
    ├── JSON 解析失败  -> 自动重试 1 次（换 Prompt 提示格式） -> 仍失败 -> 推送 error 事件
    └── Zod 校验失败   -> 记录日志，尝试用部分数据补全 -> 补全失败 -> 推送 error 事件
```

---

## 六、API 接口设计

### 6.1 大纲生成接口

Phase 1 只需要一个接口。

```
POST /api/generate
Content-Type: application/json
Accept: text/event-stream
```

**请求体**：

```typescript
interface GenerateRequest {
  /** 用户输入的文字内容，必填，1-5000 字符 */
  userInput: string;

  /** 可选：用户期望的页数，不传则由 Agent 自动推荐 */
  pageCount?: number;

  /** 可选：用户指定的 PPT 用途 */
  purpose?: string;

  /** 可选：目标受众 */
  audience?: string;
}
```

**响应**：SSE 流（`text/event-stream`）

```
event: status
data: {"type":"status","step":"intent","message":"正在分析你的需求..."}

event: intent
data: {"type":"intent","data":{...IntentAnalysis对象...}}

event: status
data: {"type":"status","step":"storyline","message":"正在构建故事线..."}

event: storyline
data: {"type":"storyline","data":{...Storyline对象...}}

event: status
data: {"type":"status","step":"outline","message":"正在生成详细大纲..."}

event: outline
data: {"type":"outline","data":{...PPTOutline对象...}}

event: done
data: {"type":"done"}
```

**错误响应**：

```
// SSE 流中的错误
event: error
data: {"type":"error","message":"大纲生成失败，请稍后重试","code":"LLM_ERROR"}

// 请求参数错误（直接返回 HTTP 400，不走 SSE）
HTTP 400
{
  "error": "userInput 不能为空",
  "code": "INVALID_INPUT"
}
```

**错误码表**：

| code | 含义 | 前端处理建议 |
|------|------|-------------|
| INVALID_INPUT | 请求参数不合法 | 提示用户修改输入 |
| LLM_ERROR | LLM 调用失败 | 提示重试 |
| LLM_PARSE_ERROR | LLM 返回的 JSON 解析失败 | 提示重试 |
| RATE_LIMIT | 调用频率超限 | 提示稍后重试 |
| INTERNAL_ERROR | 服务内部错误 | 提示联系开发者 |

---

## 七、核心模块详细设计

### 7.1 LLM 客户端封装 (`src/lib/llm-client.ts`)

```typescript
import OpenAI from "openai";

// 使用 openai SDK 连接阿里云百炼 API
const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

/**
 * 调用 LLM 并期望返回 JSON 格式
 * @param systemPrompt - 系统提示词
 * @param userPrompt - 用户提示词
 * @param options - 可选配置（温度、最大 token 等）
 * @returns 解析后的 JSON 对象
 */
export async function callLLM<T>(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number;    // 默认 0.7
    maxTokens?: number;      // 默认 4096
    model?: string;          // 默认 "qwen-max"
  }
): Promise<T> {
  const response = await client.chat.completions.create({
    model: options?.model ?? "qwen-max",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 4096,
    response_format: { type: "json_object" },  // 强制 JSON 输出
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM 返回内容为空");
  }

  return JSON.parse(content) as T;
}
```

**关键设计点**：
- `response_format: { type: "json_object" }` -- 百炼 API 兼容 OpenAI 的 JSON Mode，强制输出合法 JSON
- 重试逻辑在 Orchestrator 层实现，LLM Client 只负责单次调用
- 泛型 `<T>` 让调用方可以指定期望的返回类型，配合 Zod 校验使用

### 7.2 Orchestrator 编排器 (`src/agent/orchestrator.ts`)

```typescript
/**
 * 编排器 -- Agent 的核心流程控制
 *
 * 职责：
 * 1. 按顺序调用 M1 -> M3 -> M4
 * 2. 将上一步的输出传递给下一步
 * 3. 通过回调函数推送进度事件
 * 4. 处理错误和重试
 */
export async function generateOutline(
  input: GenerateRequest,
  onEvent: (event: SSEEvent) => void
): Promise<PPTOutline> {

  // Step 1: 意图分析
  onEvent({ type: "status", step: "intent", message: "正在分析你的需求..." });
  const intentResult = await analyzeIntent(input.userInput, {
    purpose: input.purpose,
    audience: input.audience,
  });
  onEvent({ type: "intent", data: intentResult });

  // Step 2: 故事线构建
  onEvent({ type: "status", step: "storyline", message: "正在构建故事线..." });
  const storylineResult = await buildStoryline(
    input.userInput,
    intentResult,
    input.pageCount
  );
  onEvent({ type: "storyline", data: storylineResult });

  // Step 3: 大纲细化生成
  onEvent({ type: "status", step: "outline", message: "正在生成详细大纲..." });
  const outline = await generateDetailedOutline(
    input.userInput,
    intentResult,
    storylineResult
  );
  onEvent({ type: "outline", data: outline });

  onEvent({ type: "done" });
  return outline;
}
```

**编排器的关键设计**：
- 使用回调函数 `onEvent` 推送事件，不直接依赖 SSE 细节，便于测试
- 每一步的输出都作为下一步的输入，形成"信息级联"
- 错误在每一步捕获，推送 error 事件后终止流程

### 7.3 M1 意图分析模块 (`src/agent/modules/m1-intent-analyzer.ts`)

**输入**：用户原始文本 + 可选参数（purpose, audience）

**输出**：IntentAnalysis 对象

```typescript
interface IntentAnalysis {
  /** PPT 用途 */
  purpose: string;
  /** 目标受众 */
  audience: string;
  /** 场景类型（Phase 1 固定为 B） */
  scenarioType: "B";
  /** 推荐页数 */
  pageCountSuggestion: number;
  /** 风格提示 */
  styleHint: string;
  /** 主题关键词 */
  topicKeywords: string[];
  /** 核心要解决的问题或传达的信息 */
  coreMessage: string;
  /** 置信度（0-1），低于 0.6 时理论上应追问，Phase 1 直接使用默认值 */
  confidence: number;
}
```

**实现要点**：
- 如果用户已指定 purpose/audience，直接填入，LLM 只分析其余维度
- Phase 1 场景类型固定返回 "B"（主题扩写模式）
- Prompt 中给出明确的分类选项和 JSON 格式要求

### 7.4 M3 故事线构建模块 (`src/agent/modules/m3-storyline-builder.ts`)

**输入**：用户原始文本 + IntentAnalysis

**输出**：Storyline 对象

```typescript
interface Storyline {
  /** 选择的叙事框架 */
  narrativeFramework: string;
  /** 核心信息（一句话） */
  coreMessage: string;
  /** 情感曲线描述 */
  emotionalCurve: string;
  /** 章节列表 */
  sections: Section[];
  /** 总页数 */
  totalPages: number;
}

interface Section {
  /** 章节标题 */
  title: string;
  /** 章节目的 */
  purpose: string;
  /** 页码范围 [起始页, 结束页] */
  pageRange: [number, number];
  /** 章节核心信息 */
  keyMessage: string;
}
```

**实现要点**：
- Prompt 中内置 5 种叙事框架选项（问题驱动型、成果展示型、方案提案型、教学讲解型、趋势分析型），让 LLM 选择最合适的
- 要求 LLM 确保章节页码范围无重叠、总和等于 totalPages
- 温度建议设为 0.8（鼓励创意）

### 7.5 M4 大纲细化生成模块 (`src/agent/modules/m4-outline-generator.ts`)

**输入**：用户原始文本 + IntentAnalysis + Storyline

**输出**：PPTOutline 对象（完整大纲）

```typescript
// PPTOutline 的完整类型定义见 src/types/outline.ts
// 这里只列出 M4 关键逻辑

interface PPTOutline {
  meta: OutlineMeta;
  storyline: Storyline;
  pages: Page[];
}

interface Page {
  pageNumber: number;
  section: string;
  title: string;
  creativeIntent: string;
  design: {
    layout: string;
    visualElements: string[];
    colorTone?: string;
  };
  content: {
    headline: string;
    subheadline?: string;
    body: ContentBlock[];
  };
  speakerNotes?: string;
  transitionToNext?: string;
}

interface ContentBlock {
  type: "point" | "quote" | "data" | "imageSuggestion" | "chartSuggestion";
  title?: string;
  detail: string;
  supportingData?: string;
}
```

**实现要点**：
- 这是 token 消耗最大的一步（需要生成所有页面的详细内容）
- `maxTokens` 建议设为 8192 或更高
- 温度建议设为 0.7（平衡创意和稳定性）
- Prompt 中必须明确要求：每页内容要具体可用，不能是空洞的占位符
- 如果页数较多（>15 页），考虑分批调用（每批 5-8 页），Phase 1 先整体生成

---

## 八、Prompt 设计规范

### 8.1 全局 System Prompt (`src/agent/prompts/system.ts`)

```typescript
export const SYSTEM_PROMPT = `你是一位顶尖的 PPT 内容策划专家，拥有丰富的商业演示和内容架构经验。

## 你的核心能力
- 从模糊的需求中提炼出清晰的表达逻辑
- 根据不同受众调整内容的深度和表达方式
- 构建有说服力的叙事结构
- 平衡信息密度，让每一页都有价值

## 工作原则
1. 用户的素材是"原料"，你的工作是"烹饪"而非"替换食材"
2. 每一页都要有明确的"存在理由"——这一页在整个故事中的作用是什么
3. 内容要"说人话"——避免空洞的套话和过于学术的表述
4. 设计建议要具体可执行，而不是"建议配图"这种模糊指示

## 输出要求
- 所有输出必须是合法的 JSON 格式
- 使用中文
- 不要在 JSON 之外输出任何额外文字`;
```

### 8.2 M1 意图分析 Prompt (`src/agent/prompts/m1-intent.ts`)

```typescript
export function buildM1Prompt(userInput: string, options?: { purpose?: string; audience?: string }) {
  return `## 任务
分析用户的 PPT 制作需求，理解其意图并提取关键信息。

## 用户输入
"""
${userInput}
"""

${options?.purpose ? `用户已指定用途：${options.purpose}` : ""}
${options?.audience ? `用户已指定受众：${options.audience}` : ""}

## 分析维度

1. **PPT 用途**（从以下选择最匹配的）：
   工作汇报 | 商业提案 | 教学课件 | 演讲分享 | 产品介绍 | 项目总结 | 竞品分析 | 培训材料 | 其他

2. **目标受众**：推断最可能的受众群体

3. **风格倾向**：正式严谨 | 轻松活泼 | 数据驱动 | 故事驱动 | 视觉导向

4. **推荐页数**：根据内容量和用途合理推荐（5-30页之间）

5. **主题关键词**：提取 3-5 个核心关键词

6. **核心信息**：这个 PPT 最终要传达的核心观点是什么（一句话概括）

7. **置信度**：你对以上分析的把握程度（0-1），如果用户输入很模糊，置信度应低于 0.6

## 输出 JSON 格式
{
  "purpose": "string -- PPT 用途",
  "audience": "string -- 目标受众",
  "scenarioType": "B",
  "pageCountSuggestion": "number -- 推荐页数",
  "styleHint": "string -- 风格提示",
  "topicKeywords": ["string -- 关键词数组"],
  "coreMessage": "string -- 核心信息",
  "confidence": "number -- 置信度 0-1"
}`;
}
```

### 8.3 M3 故事线构建 Prompt (`src/agent/prompts/m3-storyline.ts`)

```typescript
export function buildM3Prompt(
  userInput: string,
  intent: IntentAnalysis,
  pageCount?: number
) {
  const targetPages = pageCount ?? intent.pageCountSuggestion;

  return `## 任务
基于用户需求和意图分析结果，构建 PPT 的叙事脉络（Storyline）。

## 用户原始输入
"""
${userInput}
"""

## 意图分析结果
- 用途：${intent.purpose}
- 受众：${intent.audience}
- 风格：${intent.styleHint}
- 核心信息：${intent.coreMessage}
- 关键词：${intent.topicKeywords.join("、")}
- 目标页数：${targetPages} 页

## 可选叙事框架（选择最适合的一个，或自定义）

1. **问题驱动型**：现状 -> 问题/挑战 -> 解决方案 -> 预期效果 -> 行动计划
   适用：工作汇报、项目提案

2. **成果展示型**：背景 -> 目标 -> 执行过程 -> 取得成果 -> 下一步
   适用：项目总结、绩效汇报

3. **方案提案型**：市场机会 -> 我们的方案 -> 核心优势 -> 商业模式 -> 合作方式
   适用：商业提案、产品介绍

4. **教学讲解型**：为什么学 -> 是什么 -> 怎么用 -> 实践练习 -> 总结回顾
   适用：培训课件、教学分享

5. **趋势分析型**：行业背景 -> 关键趋势 -> 影响分析 -> 应对策略 -> 总结展望
   适用：行业分析、战略规划

## 构建要求
1. 选择叙事框架并说明选择原因
2. 确定核心信息（PPT 听完后受众应记住的一句话）
3. 规划 3-6 个章节，每个章节包含：
   - 标题
   - 目的（这一章在整体故事中的作用）
   - 页码范围
   - 关键信息点
4. 设计情感曲线
5. 所有章节的页码范围之和必须等于 ${targetPages}

## 输出 JSON 格式
{
  "narrativeFramework": "string -- 选择的叙事框架名称",
  "coreMessage": "string -- 核心信息（一句话）",
  "emotionalCurve": "string -- 情感曲线描述",
  "sections": [
    {
      "title": "string -- 章节标题",
      "purpose": "string -- 章节目的",
      "pageRange": [起始页码, 结束页码],
      "keyMessage": "string -- 章节核心信息"
    }
  ],
  "totalPages": ${targetPages}
}`;
}
```

### 8.4 M4 大纲细化生成 Prompt (`src/agent/prompts/m4-outline.ts`)

```typescript
export function buildM4Prompt(
  userInput: string,
  intent: IntentAnalysis,
  storyline: Storyline
) {
  // 将章节信息格式化为文本
  const sectionsText = storyline.sections
    .map(s => `- ${s.title}（第${s.pageRange[0]}-${s.pageRange[1]}页）：${s.purpose}。核心信息：${s.keyMessage}`)
    .join("\n");

  return `## 任务
基于已确定的故事线，为每一页生成详细的 PPT 大纲。

## 用户原始输入
"""
${userInput}
"""

## PPT 基本信息
- 用途：${intent.purpose}
- 受众：${intent.audience}
- 风格：${intent.styleHint}
- 核心信息：${storyline.coreMessage}

## 故事线
- 叙事框架：${storyline.narrativeFramework}
- 情感曲线：${storyline.emotionalCurve}
- 章节结构：
${sectionsText}
- 总页数：${storyline.totalPages}

## 每页必须包含
1. **title**：页面标题，清晰有力，最多 15 个字
2. **creativeIntent**：创作思路，解释这一页为什么这样写（1-2句话）
3. **design**：设计建议
   - layout：布局类型（如"标题页"、"三栏并列"、"左图右文"、"全图背景+文字叠加"、"数据图表+解读"等）
   - visualElements：视觉元素建议（如"图标"、"数据图表"、"配图"、"时间轴"等）
   - colorTone：可选，色调建议
4. **content**：页面内容
   - headline：主标题
   - subheadline：可选，副标题
   - body：内容块数组（每页 2-5 个内容块），每个内容块包含：
     - type：内容类型（"point" | "quote" | "data" | "imageSuggestion" | "chartSuggestion"）
     - title：可选，内容块标题
     - detail：详细内容（具体、可用的文字，不是占位符）
     - supportingData：可选，支撑数据
5. **speakerNotes**：可选，演讲备注
6. **transitionToNext**：可选，过渡到下一页的衔接语

## 内容质量标准
- 标题不超过 15 字
- 内容块的 detail 要具体、可直接使用，不能是"在此填入XX"之类的占位符
- 数据可以是示意数据，但要标注"示意数据"
- 每页内容块数量 2-5 个，避免过满或过空
- 页面之间的过渡要自然流畅

## 输出 JSON 格式
{
  "meta": {
    "title": "string -- PPT 总标题",
    "purpose": "${intent.purpose}",
    "audience": "${intent.audience}",
    "totalPages": ${storyline.totalPages},
    "scenarioType": "B"
  },
  "storyline": ${JSON.stringify(storyline)},
  "pages": [
    {
      "pageNumber": 1,
      "section": "string -- 所属章节",
      "title": "string -- 页面标题",
      "creativeIntent": "string -- 创作思路",
      "design": {
        "layout": "string",
        "visualElements": ["string"],
        "colorTone": "string（可选）"
      },
      "content": {
        "headline": "string",
        "subheadline": "string（可选）",
        "body": [
          {
            "type": "point",
            "title": "string（可选）",
            "detail": "string",
            "supportingData": "string（可选）"
          }
        ]
      },
      "speakerNotes": "string（可选）",
      "transitionToNext": "string（可选）"
    }
  ]
}

重要：pages 数组必须包含 ${storyline.totalPages} 个元素，对应第 1 页到第 ${storyline.totalPages} 页。`;
}
```

### 8.5 Prompt 设计关键原则总结

| 原则 | 说明 |
|------|------|
| **结构化输出** | 每个 Prompt 都明确定义 JSON Schema，不给 LLM 自由发挥格式的空间 |
| **信息级联** | M1 的输出嵌入 M3 的 Prompt，M3 的输出嵌入 M4 的 Prompt，逐步约束 |
| **具体的质量标准** | 不说"内容要好"，而是说"标题不超过 15 字"、"每页 2-5 个内容块" |
| **选项约束** | 叙事框架、布局类型等提供固定选项，减少 LLM 的不确定性 |
| **防护措施** | 要求"不能是占位符"、"页数必须匹配"，避免常见的 LLM 偷懒行为 |

---

## 九、前端界面设计

### 9.1 整体布局

Phase 1 采用单页面设计，分为三个主要区域：

```
┌─────────────────────────────────────────────────────┐
│                    顶部标题栏                        │
│  AIPPT 大纲生成器                                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │              输入区域                         │    │
│  │                                               │    │
│  │  [多行文本输入框，placeholder:                │    │
│  │   "请描述你的 PPT 主题，越详细越好..."]        │    │
│  │                                               │    │
│  │  可选参数（折叠面板）：                        │    │
│  │    页数: [  ]   用途: [下拉选择]               │    │
│  │    受众: [输入框]                              │    │
│  │                                               │    │
│  │              [  生成大纲  ]                    │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │              进度指示器（生成中显示）          │    │
│  │                                               │    │
│  │  [*] 分析需求  [*] 构建故事线  [ ] 生成大纲   │    │
│  │                                               │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │              大纲结果展示区                    │    │
│  │                                               │    │
│  │  === 元信息卡片 ===                           │    │
│  │  标题：XXX | 用途：XXX | 受众：XXX | 15页     │    │
│  │                                               │    │
│  │  === 故事线概览 ===                           │    │
│  │  叙事框架：问题驱动型                          │    │
│  │  核心信息：xxxxxxxxxx                          │    │
│  │  [章节1] ─── [章节2] ─── [章节3] ─── ...      │    │
│  │                                               │    │
│  │  === 逐页大纲 ===                             │    │
│  │  ┌──── 第1页 ─────────────────────┐          │    │
│  │  │ 章节：开篇引入                  │          │    │
│  │  │ 标题：XXXX                      │          │    │
│  │  │ 创作思路：xxxx                  │          │    │
│  │  │ 布局：标题页                    │          │    │
│  │  │ 内容：                          │          │    │
│  │  │   - 要点1：xxxx                 │          │    │
│  │  │   - 要点2：xxxx                 │          │    │
│  │  │ 演讲备注：xxxx                  │          │    │
│  │  └─────────────────────────────────┘          │    │
│  │                                               │    │
│  │  ┌──── 第2页 ─────────────────────┐          │    │
│  │  │ ...                             │          │    │
│  │  └─────────────────────────────────┘          │    │
│  │                                               │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 9.2 交互流程

1. **初始状态**：显示输入区域和"生成大纲"按钮，结果区域隐藏
2. **点击生成**：
   - 按钮变为 disabled + loading 状态
   - 显示进度指示器，三个步骤依次点亮
   - 输入框不可编辑
3. **生成过程中**：
   - 收到 `intent` 事件 -> 第一步完成，点亮
   - 收到 `storyline` 事件 -> 第二步完成，可提前展示故事线概览
   - 收到 `outline` 事件 -> 第三步完成，渲染完整大纲
4. **生成完成**：
   - 按钮恢复可用，文字变为"重新生成"
   - 输入框可编辑
   - 大纲结果完整展示
5. **错误处理**：
   - 收到 `error` 事件 -> 进度指示器标红当前步骤，显示错误信息和"重试"按钮

### 9.3 组件职责

| 组件 | 职责 |
|------|------|
| `InputPanel` | 包含文本输入框、可选参数（折叠面板）、生成按钮 |
| `ProgressIndicator` | 三步进度条：分析需求 -> 构建故事线 -> 生成大纲 |
| `OutlineViewer` | 大纲结果的容器组件，管理 meta/storyline/pages 三个子区域 |
| `OutlineMeta` | 展示元信息：标题、用途、受众、页数 |
| `StorylineView` | 展示故事线：叙事框架、核心信息、章节流程图 |
| `PageCard` | 单页大纲的卡片展示，包含所有页面详情 |

---

## 十、Phase 1 实施任务清单

按依赖关系排列，建议按序执行。

### 第一批：基础设施搭建（Day 1）

#### 任务 1.1：项目初始化

**目标**：创建 Next.js 项目，安装依赖，配置基础工具链。

**具体步骤**：
```bash
pnpm create next-app@latest aippt --typescript --tailwind --app --src-dir
cd aippt
pnpm add openai zod
pnpm add -D @types/node
```

**产出物**：
- 可运行的 Next.js 项目骨架
- `.env.local` 配置 `DASHSCOPE_API_KEY`
- `.env.example` 示例文件
- `tsconfig.json` 路径别名配置（`@/*` 映射 `src/*`）

**验收标准**：`pnpm dev` 能启动，访问 `localhost:3000` 看到默认页面。

---

#### 任务 1.2：定义核心类型

**目标**：编写 `src/types/` 下的所有 TypeScript 类型定义。

**产出文件**：
- `src/types/outline.ts` -- PPTOutline, Page, Section, ContentBlock, OutlineMeta
- `src/types/intent.ts` -- IntentAnalysis
- `src/types/storyline.ts` -- Storyline, Section（复用或重新定义）
- `src/types/api.ts` -- GenerateRequest, SSEEvent

**实现要点**：
- 类型命名使用驼峰（camelCase），与 JSON 输出的 key 保持一致
- 为可选字段明确使用 `?` 标记
- 添加中文 JSDoc 注释

**验收标准**：TypeScript 编译无错误，类型导入正常。

---

#### 任务 1.3：实现 LLM 客户端

**目标**：封装阿里云百炼 API 调用逻辑。

**产出文件**：`src/lib/llm-client.ts`

**实现要点**：
- 使用 `openai` SDK，`baseURL` 设为 `https://dashscope.aliyuncs.com/compatible-mode/v1`
- 实现 `callLLM<T>(systemPrompt, userPrompt, options)` 函数
- 启用 `response_format: { type: "json_object" }` 强制 JSON 输出
- 错误处理：网络错误、API 错误、JSON 解析错误分别抛出不同类型的错误
- 添加请求日志（console.log 即可，记录调用的模型、token 消耗）

**验收标准**：能成功调用百炼 API，返回 JSON 格式的响应。

---

#### 任务 1.4：实现 Zod 校验器

**目标**：为 M1/M3/M4 的输出定义 Zod Schema，用于校验 LLM 返回的 JSON。

**产出文件**：`src/lib/validators.ts`

**实现要点**：
- 定义 `intentAnalysisSchema`、`storylineSchema`、`pptOutlineSchema`
- Schema 对可选字段使用 `.optional()`
- Schema 对枚举字段使用 `.enum()` 约束
- 导出 `validateIntentAnalysis(data)`、`validateStoryline(data)`、`validateOutline(data)` 函数
- 校验失败时抛出详细错误信息（哪个字段不合法）

**验收标准**：对合法数据校验通过，对缺少必填字段的数据校验失败并给出清晰的错误信息。

---

### 第二批：Agent 核心模块（Day 2-3）

#### 任务 2.1：编写 Prompt 模板

**目标**：实现三个模块的 Prompt 构建函数。

**产出文件**：
- `src/agent/prompts/system.ts` -- 全局 System Prompt
- `src/agent/prompts/m1-intent.ts` -- `buildM1Prompt(userInput, options?)` 函数
- `src/agent/prompts/m3-storyline.ts` -- `buildM3Prompt(userInput, intent, pageCount?)` 函数
- `src/agent/prompts/m4-outline.ts` -- `buildM4Prompt(userInput, intent, storyline)` 函数

**实现要点**：
- Prompt 内容参考本文档第八章
- 使用模板字符串动态注入上下文
- 每个 Prompt 函数只返回 User Prompt 字符串，System Prompt 单独管理

**验收标准**：传入测试数据，Prompt 函数输出的文本结构清晰、JSON 格式要求明确。

---

#### 任务 2.2：实现 M1 意图分析模块

**目标**：实现意图分析的完整逻辑。

**产出文件**：`src/agent/modules/m1-intent-analyzer.ts`

**实现要点**：
- 导出 `analyzeIntent(userInput, options?)` 异步函数
- 内部调用 `callLLM` + Zod 校验
- 如果用户已提供 purpose/audience，在 Prompt 中注入，让 LLM 跳过这些维度的分析
- `scenarioType` 在 Phase 1 固定返回 `"B"`
- 温度设为 `0.3`（意图分析需要稳定性，不需要创意）

**验收标准**：输入 "帮我做一个关于 AI 教育的商业提案 PPT"，返回合理的 IntentAnalysis 对象。

---

#### 任务 2.3：实现 M3 故事线构建模块

**目标**：实现故事线构建的完整逻辑。

**产出文件**：`src/agent/modules/m3-storyline-builder.ts`

**实现要点**：
- 导出 `buildStoryline(userInput, intent, pageCount?)` 异步函数
- 将 IntentAnalysis 注入 Prompt 作为上下文
- 温度设为 `0.8`（鼓励创意）
- 校验章节 pageRange 的合法性：无重叠、覆盖所有页码、总和等于 totalPages
- 如果校验失败，记录警告日志但不阻断流程（LLM 的小错误可以容忍）

**验收标准**：输入测试数据，返回结构合理的 Storyline，章节划分逻辑清晰。

---

#### 任务 2.4：实现 M4 大纲细化生成模块

**目标**：实现逐页大纲生成的完整逻辑。

**产出文件**：`src/agent/modules/m4-outline-generator.ts`

**实现要点**：
- 导出 `generateDetailedOutline(userInput, intent, storyline)` 异步函数
- 将 IntentAnalysis + Storyline 完整注入 Prompt
- `maxTokens` 设为 `8192`（内容量大）
- 温度设为 `0.7`
- 组装最终的 PPTOutline 对象（meta 从 intent 提取，storyline 从 M3 传入，pages 从 M4 输出提取）
- Zod 校验整个 PPTOutline

**验收标准**：输入测试数据，返回完整的 PPTOutline，每页内容具体可用。

---

#### 任务 2.5：实现 Orchestrator 编排器

**目标**：串联 M1 -> M3 -> M4 的完整流程。

**产出文件**：`src/agent/orchestrator.ts`

**实现要点**：
- 导出 `generateOutline(input, onEvent)` 异步函数
- 按顺序调用三个模块，通过 `onEvent` 回调推送进度
- 每一步用 try-catch 包裹，捕获错误后通过 `onEvent` 推送 error 事件
- 对 LLM 调用失败实现 1 次自动重试

**验收标准**：能端到端运行完整流程，从用户输入到最终输出 PPTOutline。

---

### 第三批：API 和前端（Day 3-4）

#### 任务 3.1：实现 API Route

**目标**：实现 SSE 流式响应的 API 接口。

**产出文件**：`src/app/api/generate/route.ts`

**实现要点**：
- 使用 Next.js Route Handler
- 解析请求体，用 Zod 校验 GenerateRequest
- 创建 `ReadableStream`，在 stream 中调用 `generateOutline`
- `onEvent` 回调中将事件序列化为 SSE 格式写入 stream
- 设置响应头：`Content-Type: text/event-stream`、`Cache-Control: no-cache`、`Connection: keep-alive`

**SSE 格式参考**：
```
event: status\ndata: {"type":"status","step":"intent","message":"正在分析..."}\n\n
```

**验收标准**：使用 curl 或 Postman 调用接口，能收到 SSE 事件流。

---

#### 任务 3.2：实现前端输入组件

**目标**：实现用户输入面板。

**产出文件**：
- `src/components/InputPanel.tsx`
- `src/components/GenerateButton.tsx`

**实现要点**：
- 多行文本输入框（textarea），最小高度 120px，最大 5000 字符
- 可选参数区域（默认折叠）：页数输入、用途下拉选择、受众文本框
- "生成大纲"按钮，点击时触发回调，传出 GenerateRequest 数据
- 生成中状态：按钮 disabled + spinner 动画，输入框 readonly

**验收标准**：界面美观可用，能正确收集用户输入。

---

#### 任务 3.3：实现进度指示器和 SSE 客户端

**目标**：实现生成进度展示和 SSE 事件消费逻辑。

**产出文件**：
- `src/components/ProgressIndicator.tsx`

**在 `src/app/page.tsx` 中实现 SSE 消费逻辑**：
- 使用 `fetch` + `ReadableStream` 读取 SSE 流
- 解析每条 SSE 事件，更新 React 状态
- 三步进度指示器：每步有"等待中"、"进行中"、"已完成"、"失败"四种状态

**验收标准**：生成过程中进度条逐步推进，错误时标红。

---

#### 任务 3.4：实现大纲结果展示组件

**目标**：将 PPTOutline 数据渲染为可读的大纲视图。

**产出文件**：
- `src/components/OutlineViewer.tsx` -- 容器组件
- `src/components/OutlineMeta.tsx` -- 元信息卡片
- `src/components/StorylineView.tsx` -- 故事线展示
- `src/components/PageCard.tsx` -- 单页大纲卡片

**实现要点**：
- `OutlineMeta`：展示标题、用途、受众、总页数，用卡片样式
- `StorylineView`：展示叙事框架、核心信息；章节用横向流程图展示（简单的 flex 布局 + 箭头连接）
- `PageCard`：每页一张卡片，包含：
  - 页码 + 所属章节（标签样式）
  - 页面标题（大字）
  - 创作思路（斜体灰色文字）
  - 设计建议（布局类型 + 视觉元素标签）
  - 内容（headline + body 列表）
  - 演讲备注（折叠区域）
  - 过渡语（底部分隔线 + 灰色文字）

**验收标准**：PPTOutline 数据能完整、清晰地展示，页面可滚动浏览所有页。

---

#### 任务 3.5：页面集成

**目标**：将所有组件集成到首页，完成端到端流程。

**产出文件**：`src/app/page.tsx`（主页面）、`src/app/layout.tsx`（布局）、`src/app/globals.css`

**实现要点**：
- 页面状态管理：idle -> generating -> done / error
- SSE 消费逻辑：`fetch("/api/generate", { method: "POST", body })` 然后读取 stream
- 响应式布局：移动端可用（输入框和结果纵向排列）
- 页面标题 "AIPPT 大纲生成器"

**验收标准**：完整的端到端流程可运行 -- 输入文字 -> 点击生成 -> 看到进度 -> 看到完整大纲。

---

### 第四批：打磨和验证（Day 5）

#### 任务 4.1：Prompt 调优

**目标**：用 10 个不同主题测试，优化 Prompt 质量。

**测试用例建议**：
1. "帮我做一个关于 AI 在教育中应用的 PPT"
2. "Q1 销售业绩汇报"
3. "新产品发布方案"
4. "数字化转型战略规划"
5. "团队年终总结"
6. "创业融资 BP"
7. "Python 编程入门课件"
8. "健康饮食科普演讲"
9. "项目风险评估报告"
10. "公司文化宣讲"

**调优方向**：
- 内容是否具体、可用（而非空洞套话）
- 逻辑结构是否连贯
- 页数分配是否合理
- 设计建议是否具体可操作

---

#### 任务 4.2：错误处理完善

**目标**：确保各种异常情况都有合理的用户提示。

**检查清单**：
- [ ] 空输入提交 -> 前端校验提示
- [ ] 超长输入（>5000 字符） -> 前端校验提示
- [ ] API Key 无效 -> 友好错误提示
- [ ] LLM 返回非 JSON -> 重试 1 次后提示错误
- [ ] 网络断开 -> 提示网络异常
- [ ] 生成中刷新页面 -> 无异常（流自动关闭）

---

## 十一、关键注意事项

### 11.1 百炼 API 使用注意

1. **API Key**：在 `.env.local` 中配置 `DASHSCOPE_API_KEY`，不要提交到 Git
2. **模型名称**：使用 `qwen-max`（百炼平台的 Qwen-Max 模型标识）
3. **JSON Mode**：百炼 API 支持 `response_format: { type: "json_object" }`，但需要在 Prompt 中明确要求输出 JSON，否则可能不生效
4. **Token 限制**：Qwen-Max 的上下文窗口为 32K token，M4 的 Prompt + 输出可能较大，需关注
5. **速率限制**：百炼有 QPS 和 TPM 限制，Phase 1 单用户使用一般不会触发，但要做好错误处理

### 11.2 性能预期

| 步骤 | 预计耗时 | 说明 |
|------|----------|------|
| M1 意图分析 | 2-5 秒 | 输入短，输出短 |
| M3 故事线 | 3-8 秒 | 输出中等长度 |
| M4 大纲生成 | 8-20 秒 | 输出较长（15 页的详细内容） |
| **总计** | **13-33 秒** | 取决于页数和网络状况 |

SSE 的意义：用户不需要干等 30 秒，而是逐步看到进度和中间结果。

### 11.3 Phase 2 扩展预留

当前架构已为后续扩展预留了空间：

| 扩展方向 | 预留设计 |
|----------|----------|
| 文档上传（M0） | Agent 模块目录结构已预留 `m0-preprocessor.ts` 位置 |
| 联网搜索（M2） | Orchestrator 中 M1 和 M3 之间可插入 M2 调用 |
| 质量审查（M5） | Orchestrator 中 M4 之后可追加 M5 调用 |
| 追问交互 | SSE 事件类型可扩展 `clarification` 类型，前端增加对话交互 |
| 大纲编辑 | 当前类型定义完整，可直接在前端实现编辑功能 |
| 持久化存储 | 当前无数据库依赖，后续可接入任意数据库保存历史记录 |

---

## 十二、给执行 Agent 的开发指令

以下是按模块拆分的开发指令，每条指令可独立交给执行 Agent 完成。

### 指令 1：项目初始化

```
请执行以下操作：
1. 使用 pnpm create next-app@latest 创建项目，名为 aippt，启用 TypeScript + Tailwind + App Router + src 目录
2. 进入项目目录，安装依赖：pnpm add openai zod
3. 创建 .env.local 文件，内容：DASHSCOPE_API_KEY=your_key_here
4. 创建 .env.example 文件，内容：DASHSCOPE_API_KEY=在此填入你的阿里云百炼 API Key
5. 确保 .gitignore 中包含 .env.local
6. 创建以下空目录结构：
   src/agent/modules/
   src/agent/prompts/
   src/lib/
   src/types/
   src/components/
   tests/agent/
   tests/lib/
7. 验证 pnpm dev 能正常启动
```

### 指令 2：类型定义

```
请在 src/types/ 目录下创建以下文件，定义 TypeScript 类型。
所有类型使用驼峰命名，添加中文 JSDoc 注释。

具体类型定义参考本文档第七章的类型定义。
文件列表：outline.ts、intent.ts、storyline.ts、api.ts
```

### 指令 3：LLM 客户端 + Zod 校验

```
请实现：
1. src/lib/llm-client.ts -- 封装百炼 API 调用，使用 openai SDK
2. src/lib/validators.ts -- 为 IntentAnalysis、Storyline、PPTOutline 定义 Zod Schema

参考本文档第七章 7.1 节和任务 1.3、1.4 的实现要点。
```

### 指令 4：Prompt 模板

```
请实现 src/agent/prompts/ 下的四个文件：
system.ts、m1-intent.ts、m3-storyline.ts、m4-outline.ts

Prompt 内容参考本文档第八章，注意：
- 每个文件导出一个构建函数
- system.ts 导出常量字符串
- 使用模板字符串动态注入上下文
```

### 指令 5：Agent 模块

```
请实现 src/agent/modules/ 下的三个模块和 orchestrator：
1. m1-intent-analyzer.ts -- 意图分析
2. m3-storyline-builder.ts -- 故事线构建
3. m4-outline-generator.ts -- 大纲生成
4. src/agent/orchestrator.ts -- 编排器

每个模块调用 llm-client + 对应的 prompt + zod 校验。
Orchestrator 串联 M1 -> M3 -> M4，通过 onEvent 回调推送事件。
参考本文档第七章 7.2-7.5 节。
```

### 指令 6：API Route

```
请实现 src/app/api/generate/route.ts：
- POST 方法，接收 GenerateRequest
- 返回 SSE 流式响应
- 内部调用 orchestrator.generateOutline
- 参考本文档第六章的接口设计
```

### 指令 7：前端界面

```
请实现前端所有组件和页面：
1. src/components/ 下的所有组件（参考本文档第九章 9.3 节的组件列表）
2. src/app/page.tsx -- 主页面，集成所有组件
3. src/app/layout.tsx -- 全局布局
4. src/app/globals.css -- Tailwind 基础样式

交互流程参考本文档第九章 9.2 节。
使用 Tailwind CSS 样式，不需要额外的 CSS 文件。
界面简洁实用，重点是能清晰展示大纲内容。
```
