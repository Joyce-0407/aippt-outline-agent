# AIPPT Phase 2 计划 - 文档解析增强

**版本**：v1.0
**更新时间**：2026-03-05
**状态**：待启动
**依赖**：Phase 1 MVP 完全完成
**预计周期**：3 周（2026-03-24 - 2026-04-11）

---

## 一、Phase 2 核心目标

支持用户上传文档（PDF / Word / Markdown / TXT），系统自动解析文档内容，根据文档结构类型（结构化 / 散乱内容）选择合适的场景路由，生成 PPT 大纲。

**关键差异 vs Phase 1**：
- Phase 1：用户手工输入文字 → 直接进入 M1（场景固定为 B）
- Phase 2：用户上传文档 → M0 文档解析 → 自动路由到场景 A / B / C → M1-M4 管道

---

## 二、需求分析与场景划分

### 2.1 文档支持格式

| 格式 | 解析库 | 难度 | 优先级 | 备注 |
|------|------|------|--------|------|
| **PDF** | pdf-parse | 中 | P0 | 文本提取，暂不提取表格/图片 |
| **Word (.docx)** | mammoth | 中 | P0 | 提取文本和基础格式（标题、列表） |
| **Markdown** | 原生 readFileSync | 低 | P1 | 直接读取文件内容，无需解析库 |
| **TXT** | 原生 readFileSync | 低 | P1 | 直接读取，无需处理 |

### 2.2 场景路由逻辑

文档解析后，M0 模块需要判断文档结构类型，影响后续流程：

**场景 A：结构化文档**（有明确分页标记或大纲结构）
- 特征：包含明显的章节标题、分页符、编号列表等
- 路由：M1 分析意图 → M3 故事线 → **M4A 结构还原**（优先保留原结构，补充内容）
- 优势：文档本身已有逻辑框架，直接转化
- 示例：教材、PPT 导出的 TXT、结构化笔记

**场景 B：主题型文档**（有核心主题但内容相对分散）
- 特征：围绕一个主题展开，但缺少明确分页或结构
- 路由：M1 分析意图 → M3 故事线 → **M4B 主题扩写**（当前 Phase 1 流程）
- 优势：充分利用现有 M1-M4 逻辑
- 示例：博客文章、产品文档、案例分析

**场景 C：散乱内容**（无明确逻辑或混合多个主题）
- 特征：内容杂乱、主题不清、信息碎片化
- 路由：M1 分析意图 → **M0C 智能分类** → M3 故事线 → M4 生成
- 优势：需要额外的内容分类逻辑，后续扩展
- 示例：杂志文章、会议笔记、混合素材

### 2.3 场景识别规则（M0 核心逻辑）

```
输入：解析后的文本内容 + 格式元数据
↓
检查：
1. 是否包含分页符（PDF 页数 > 3）？→ 场景 A
2. 是否有明确章节标题（标题行数 > 总行数的 10%）？→ 场景 A
3. 是否包含编号列表（1. 2. 3.）或分级标题（# ## ###）？→ 场景 A
4. 其他情况：默认场景 B（主题型）
→ 如果检测失败或无法确定，也默认场景 B

输出：
{
  "scenarioType": "A" | "B" | "C",
  "confidence": 0.7,
  "structureDetails": {
    "estimatedSections": 5,
    "hasPageBreaks": true,
    "hasTitleStructure": true
  },
  "documentMetadata": {
    "totalCharacters": 5000,
    "estimatedPages": 8,
    "detectedLanguage": "zh"
  }
}
```

---

## 三、任务详细拆解

### 任务 T1：依赖库版本规划与安装

**输入**：当前项目 package.json
**输出**：更新 package.json，安装新依赖
**工作量**：0.5 小时

**子任务**：
1. 评估库选型（pdf-parse vs pdfjs-dist）→ **推荐 pdf-parse**（更轻量）
2. 选择 Word 解析库（mammoth vs docx）→ **推荐 mammoth**（稳定成熟）
3. 考虑 Markdown 是否需要解析库（推荐直接读取）
4. 执行 `npm install pdf-parse mammoth` 并测试导入

**验收标准**：
- [ ] 库版本已添加到 package.json
- [ ] `npm install` 成功
- [ ] 在 Node.js REPL 中可成功 `import` 这些库

**风险**：
- pdf-parse 可能在某些复杂 PDF 上失效 → 备选方案：pdfjs-dist
- mammoth 对装修格式的 Word 文件支持有限 → 验证测试用例

---

### 任务 T2：M0 文档解析模块设计与类型定义

**输入**：格式需求、场景识别规则
**输出**：`src/types/document.ts` 和 `src/agent/modules/m0-document-parser.ts` 框架
**工作量**：2 小时

**核心内容**：

#### T2.1 类型定义（`src/types/document.ts`）

```typescript
// 支持的文档格式
export type DocumentFormat = "pdf" | "docx" | "markdown" | "txt";

// 解析结果
export interface DocumentParseResult {
  format: DocumentFormat;
  rawText: string;          // 解析后的纯文本
  metadata: DocumentMetadata;
  structureAnalysis: StructureAnalysis;
}

export interface DocumentMetadata {
  fileName: string;
  fileSizeBytes: number;
  estimatedPages: number;
  detectedLanguage: string;  // 用 detect-language 库
  parseTimestampMs: number;
}

// 结构分析结果（用于场景路由）
export interface StructureAnalysis {
  scenarioType: "A" | "B" | "C";
  confidence: number;        // 0-1，置信度
  characteristics: {
    hasPageBreaks: boolean;
    hasHeadingStructure: boolean;
    hasNumberedLists: boolean;
    estimatedSections: number;
  };
  reasoning: string;         // 解释为何判定为该场景
}
```

#### T2.2 M0 模块框架（`src/agent/modules/m0-document-parser.ts`）

```typescript
export class DocumentParser {
  // 主方法：接收文件，返回解析结果
  async parseDocument(
    fileBuffer: Buffer,
    format: DocumentFormat,
    fileName: string
  ): Promise<DocumentParseResult>;

  // 内部方法：场景识别
  private analyzeStructure(text: string): StructureAnalysis;

  // 内部方法：内容清理（移除多余空白、标准化换行）
  private normalizeText(text: string): string;
}
```

**验收标准**：
- [ ] 所有类型定义完整，符合 TypeScript 严格模式
- [ ] M0 类结构清晰，包含详细 JSDoc 注释
- [ ] 可通过 `new DocumentParser().parseDocument()` 调用（但实现可为 stub）

**风险**：
- 场景识别规则过于简单 → Phase 2 中期可迭代优化

---

### 任务 T3：PDF / Word / Markdown / TXT 文件解析实现

**输入**：T2 定义的类型和框架
**输出**：完整的 M0 模块实现
**工作量**：3.5 小时

**分解**：

#### T3.1 PDF 解析（pdf-parse 集成）
- 使用 `pdf-parse` 提取文本
- 处理多页 PDF，记录页数
- 错误处理：损坏的 PDF、密码保护等
- 测试：`sample.pdf` 应正确提取文本

#### T3.2 Word 解析（mammoth 集成）
- 使用 `mammoth.extractRawText()` 提取纯文本
- 保留基础格式信息（标题通过缩进/标记识别）
- 错误处理：损坏的 .docx、过旧格式等
- 测试：`sample.docx` 应正确提取文本

#### T3.3 Markdown / TXT 解析
- 直接 `fs.readFileSync()`，编码检测（utf-8 / gbk）
- 对 Markdown 进行基础结构识别（# ## ### 标题）
- 测试：`sample.md`、`sample.txt` 应正确读取

#### T3.4 场景识别逻辑实现
- 计算标题行占比、列表项数量、分页符数量等特征
- 基于特征得分判定场景（A / B / C）
- 生成 reasoning 字段说明判定原因

**验收标准**：
- [ ] 所有 4 种格式都能成功解析测试文件
- [ ] 场景识别逻辑在示例上准确率 ≥ 80%
- [ ] 错误处理完整（包括文件损坏、编码错误等）
- [ ] 代码覆盖率 ≥ 80%（针对核心逻辑）

**风险**：
- PDF/Word 解析的边界情况（复杂格式、特殊字符） → 使用 mock 数据进行开发
- 场景识别误判 → 后续可在 M1 阶段微调

---

### 任务 T4：M1 意图分析模块升级（支持文档内容）

**输入**：M0 解析结果、Phase 1 已完成的 M1 模块
**输出**：升级后的 M1，接收文档内容并提升准确度
**工作量**：1.5 小时

**改造点**：

#### T4.1 扩展 M1 输入类型
```typescript
export interface IntentAnalysisInput {
  userInput: string;        // 文字输入或文档解析后的文本
  documentMetadata?: DocumentMetadata;  // 如果来自文档，附加元数据
  scenarioType?: "A" | "B" | "C";      // M0 识别的场景类型
}
```

#### T4.2 升级 M1 Prompt
- 增加对文档元信息的考虑（如来自教材、博客等）
- 针对场景 A，提示 LLM 更多保留原结构
- 针对场景 C，提示 LLM 强化内容梳理
- 示例 Prompt 调整见 T8

#### T4.3 集成 Orchestrator
- Orchestrator 接收可选的 `documentParseResult`
- 若有文档，先调用 M0，再传结果给 M1
- 若无文档，走 Phase 1 流程（场景固定 B）

**验收标准**：
- [ ] M1 可接受 `documentParseResult` 参数
- [ ] Prompt 已升级，能识别场景类型
- [ ] 手动测试：同一主题，文档输入 vs 文字输入，结果差异明显

---

### 任务 T5：M4 大纲生成模块升级（支持场景 A 还原）

**输入**：M0 识别的场景、M3 生成的故事线
**输出**：能根据场景类型生成不同风格大纲的 M4
**工作量**：2.5 小时

**改造点**：

#### T5.1 M4 路由逻辑
- 若 scenarioType = A（结构化）：调用 `generateOutlineFromStructure()`
- 若 scenarioType = B（主题型）：调用 `generateOutlineFromTheme()`（Phase 1 既有）
- 若 scenarioType = C（散乱）：调用 `generateOutlineFromScatter()`（后期可选）

#### T5.2 M4A 结构还原逻辑
- Prompt：优先提取原文档的大纲框架
- 对每一段，保留核心信息，补充细节
- 生成结果页数 ≈ 原文档的逻辑页数

#### T5.3 M4B 主题扩写逻辑（既有）
- 保持 Phase 1 逻辑不变

#### T5.4 M4C 散乱重组逻辑
- **Phase 2 暂不实现**，预留接口

**验收标准**：
- [ ] M4 能接收并识别 scenarioType
- [ ] 针对不同场景，生成逻辑清晰
- [ ] 手动测试：结构化文档 (A) 输入，生成结果保留原结构

---

### 任务 T6：API 路由升级（支持 multipart/form-data 文件上传）

**输入**：Phase 1 已有的 `/api/generate` 路由
**输出**：支持文件上传的新路由或升级版本
**工作量**：2 小时

**方案选择**：

**方案 A**（推荐）：新增 `/api/parse` 和 `/api/generate` 支持 multipart
- `/api/parse`：纯文件解析，返回 `DocumentParseResult`
- `/api/generate`：升级支持 multipart，文本输入和文件二选一或同时提供

**方案 B**：仅升级 `/api/generate`
- 统一入口，但逻辑更复杂

**执行**（选方案 A）：

#### T6.1 文件上传处理库
- 使用 Next.js 内置的 `FormData` 解析（不需额外库）
- 或使用 `formidable` / `busboy` 处理大文件

#### T6.2 实现 `/api/parse` 路由
```typescript
// POST /api/parse
// 请求：multipart/form-data，包含 file（单个文件）
// 响应：JSON { documentParseResult: DocumentParseResult }
```

#### T6.3 升级 `/api/generate` 路由
```typescript
// POST /api/generate
// 请求体可包含：
//   - userInput (string) + llmConfig
//   - file (multipart) + llmConfig
//   - 两者都有时，合并内容
// 响应：SSE 流，格式同 Phase 1
```

**验收标准**：
- [ ] `/api/parse` 可接收单个文件，返回解析结果
- [ ] `/api/generate` 可接收 userInput（Phase 1 既有）或 file
- [ ] 错误处理完整（文件过大、格式不支持等）
- [ ] 集成测试：使用 curl / Postman 验证端点可用

---

### 任务 T7：前端文档上传 UI 组件

**输入**：无
**输出**：`components/DocumentUpload.tsx`、`components/FilePreview.tsx` 等
**工作量**：3 小时

**核心组件**：

#### T7.1 DocumentUpload 组件（主组件）
- 拖拽区域 + 点击选择
- 支持 PDF / Word / Markdown / TXT
- 支持多文件（最多 3 个，显示队列）
- 单位：单次最多 10MB 单文件，总共 30MB
- 显示上传进度（不是 100% 真实进度，可用假进度）

#### T7.2 FilePreview 组件
- 上传后显示文件名、大小、状态
- 支持删除（从队列移除）
- 支持预览（大纲显示文本摘要）

#### T7.3 InputPanel 升级
- 原有的文本输入框保留
- 新增 DocumentUpload 组件
- Tab 切换：「文字输入」 vs 「文档上传」
- 或并行显示：文本输入 + 文档上传（推荐，用户可同时提供）

#### T7.4 交互流程
1. 用户选择上传文件 → 显示文件列表和进度
2. 点击「解析」→ 调用 `/api/parse`，显示解析结果（结构分析、场景类型）
3. 点击「生成大纲」→ 调用 `/api/generate`，传入文件和 userInput，启动 SSE
4. 前端展示进度和逐页结果（同 Phase 1）

**验收标准**：
- [ ] 拖拽上传可用
- [ ] 文件列表显示正确
- [ ] 解析状态能显示场景类型
- [ ] 样式美观，响应式布局（手机也能用）
- [ ] 用户可在不上传的情况下，仍用文字输入走 Phase 1 流程

**风险**：
- 大文件上传时 UI 卡顿 → 使用 Web Workers 或分块上传（Phase 3 优化）

---

### 任务 T8：Prompt 设计与测试（M0 / M1 / M4 升级）

**输入**：新增的场景识别需求、文档支持
**输出**：更新后的 Prompt 文件，通过测试用例
**工作量**：3 小时

**涉及文件**：
- `src/agent/prompts/m0-document-analysis.ts`（新增）
- `src/agent/prompts/m1-intent.ts`（升级）
- `src/agent/prompts/m4-outline.ts`（升级）

#### T8.1 M0 场景识别 Prompt
- **输入**：文档解析后的文本、元数据（格式、页数等）
- **输出**：JSON
  ```json
  {
    "scenarioType": "A|B|C",
    "confidence": 0.8,
    "reasoning": "该文档包含明确的章节标题和分页标记..."
  }
  ```
- **测试用例**（3-5 个）：
  - 结构化教材 → A
  - 博客文章 → B
  - 会议笔记 → B 或 C

#### T8.2 M1 意图分析 Prompt 升级
- 新增条件分支：如果输入来自文档，强调场景意识
- 示例：
  ```
  用户输入以下内容，可能来自{文档格式}：
  {content}

  该文档的场景类型为 {scenarioType}。

  请分析该{文档|文本}的 PPT 用途、受众等...
  ```

#### T8.3 M4 大纲生成 Prompt 升级
- 路由：
  - 若 A（结构化）：`prompts/m4-outline-from-structure.ts`
  - 若 B（主题型）：`prompts/m4-outline-from-theme.ts`（既有）
  - 若 C（散乱）：暂不实现

#### T8.4 测试计划
- 准备 3-5 个示例文档（PDF / Word / Markdown）
- 逐个通过管道运行，记录结果
- 验证：
  - 场景识别准确率 ≥ 80%
  - M1 输出的 purpose / audience 合理
  - M4 输出的大纲与原文档逻辑相符

**验收标准**：
- [ ] 所有 Prompt 文件完成编写
- [ ] 测试用例通过，无明显输出格式错误
- [ ] 记录 Prompt 迭代日志（包括调整原因）

---

### 任务 T9：文档上传 API 集成测试

**输入**：T3 / T6 / T7 完成的模块
**输出**：端到端测试通过，文档上传能正常工作
**工作量**：1.5 小时

**测试覆盖**：

#### T9.1 单元测试
- M0 解析模块：各格式文件能正确解析
- 场景识别：准确率 ≥ 80%

#### T9.2 集成测试
- `/api/parse`：上传文件 → 返回解析结果
- `/api/generate`：上传文件 + llmConfig → SSE 流生成

#### T9.3 E2E 测试（手动）
1. 准备测试文件：
   - `test-a.pdf`（结构化）
   - `test-b.docx`（主题型）
   - `test-c.txt`（散乱）
2. 打开前端页面 → 上传文件 → 查看解析结果 → 点击生成 → 检查大纲质量

#### T9.4 兼容性测试
- 边界情况：空文件、超大文件（>10MB）、损坏文件
- 错误提示：用户友好的错误信息

**验收标准**：
- [ ] 所有测试用例通过（除已知的后期优化项）
- [ ] 错误处理完整，用户界面无崩溃
- [ ] 至少 3 个完整的端到端流程成功运行

---

### 任务 T10：文档上传 UI 集成与优化

**输入**：T7 完成的组件、T6 完成的 API
**输出**：前端页面能完整处理文档上传流程
**工作量**：2 小时

**集成内容**：

#### T10.1 页面流程集成
- InputPanel + DocumentUpload 并列或 Tab 切换
- 文件上传 → 调用 `/api/parse` → 显示解析结果
- 用户确认 → 调用 `/api/generate` → SSE 展示

#### T10.2 状态管理
- 上传中、解析中、生成中等状态清晰显示
- 支持取消上传 / 重新上传
- 错误状态能重试

#### T10.3 UI 优化
- 移动端适配（响应式）
- 加载动画、骨架屏等
- 文件预览（显示文本摘要）

#### T10.4 用户引导
- 首次使用的提示文案
- 文件格式、大小限制的说明
- 场景类型的解释（为用户展示 A / B / C 含义）

**验收标准**：
- [ ] 从上传到生成结果的整个流程无 UI 错误
- [ ] 手机浏览器上也能正常使用
- [ ] 错误提示清晰，用户知道该怎么做

---

### 任务 T11：文档合并与内容处理（可选优化）

**输入**：多个文件的解析结果
**输出**：合并后的文本内容和合并策略
**工作量**：1.5 小时（可延后到 Phase 2 中期）

**功能**：
- 用户可同时上传多个文件（最多 3 个）
- 系统合并多个文档的内容
- 生成一份综合大纲

**实现**：
- 按上传顺序拼接文本
- 或按原文档的分段独立分析（高级：不在 Phase 2 实现）

**验收标准**：
- [ ] 2-3 个文件合并后能生成合理大纲

**风险**：
- 内容重复、逻辑混乱 → Phase 2 可作为选题优化

---

## 四、依赖关系与执行顺序

### 关键路径（关键任务必须按序完成）

```
T2 (类型定义)
  ↓
T3 (文件解析实现)
  ↓
T4 (M1 升级) ┐
            ├→ T5 (M4 升级) ──┐
T1 (库安装)  ┘                │
                             ├→ T8 (Prompt 调试) ──┐
T6 (API 升级) ────────────────┘                    │
                                                 ├→ T9 (集成测试)
T7 (前端 UI)  ─────────────────────────────────→ T10 (UI 集成) ──┤
                                                                 ↓
T11 (可选：多文件合并) ─────────────────────────────────────────↓
```

### 建议执行时间表

| 周 | 任务 | 预计工时 | 状态 |
|----|------|---------|------|
| **W1 (3/24-3/28)** | T1, T2, T3 | 6h | 待启动 |
| **W2 (3/31-4/4)** | T4, T5, T6 | 6h | 待启动 |
| **W2-W3 (4/1-4/4)** | T7, T8 | 6h | 待启动 |
| **W3 (4/7-4/11)** | T9, T10, T11(可选) | 4.5h | 待启动 |
| **机动 (4/11后)** | Prompt 优化、文档完善 | 2h | 待启动 |

**总计**：~24.5 小时（相当于 3 周，每周 8 小时）

---

## 五、潜在风险与应对策略

| 风险 | 概率 | 影响 | 应对策略 |
|------|------|------|---------|
| **PDF 解析失效**（复杂格式、扫描件） | 高 | 用户上传无法用 | 提前测试主流 PDF 库；推荐用户上传纯文本 PDF；后期考虑 OCR |
| **Word 解析丢失格式**（表格、图片） | 中 | 内容不完整 | 明确告知仅支持纯文本提取；显示解析结果供用户确认 |
| **场景识别误判**（A/B/C 错误） | 中 | 大纲风格不符预期 | 在前端显示识别结果，用户可手动修改；持续优化 Prompt |
| **文件过大导致解析超时** | 中 | 用户体验差、API 超时 | 限制文件大小（单个 10MB）；实现分块上传（Phase 3） |
| **多文件合并逻辑不清** | 低 | 合并结果逻辑混乱 | T11 暂不实现，Phase 2 中期评估 |
| **Prompt 输出格式不稳定** | 中 | JSON 解析失败 | 使用 Zod 校验；加入重试逻辑；更新 Prompt |
| **编码问题**（utf-8/gbk 混用） | 低 | 中文乱码 | 使用 chardet 自动检测编码；明确要求 utf-8 |

**关键应对**：
- **提前风险评估**：W1 完成 T3 后立即用真实文件测试，发现问题早调整
- **降级方案**：如 PDF 解析失败，提示用户导出为 TXT 重试
- **用户确认机制**：显示解析结果和场景类型，用户可调整后再生成

---

## 六、技术决策记录

### 6.1 为什么选 pdf-parse 而非 pdfjs-dist？

| 库 | 优点 | 缺点 | 选择 |
|----|------|------|------|
| **pdf-parse** | 轻量、简洁，适合后端 | 对复杂 PDF 支持一般 | ✅ Phase 2 优先 |
| **pdfjs-dist** | 功能强大，官方库 | 体积大，更适合前端 | 备选（Phase 3） |

**决策**：先用 pdf-parse 快速验证，遇到问题再换 pdfjs-dist。

### 6.2 为什么新增 `/api/parse` 而非只升级 `/api/generate`？

**理由**：
- 前端需要先查看解析结果（场景类型、内容摘要）后再决定生成
- 解析和生成分离，便于调试和缓存
- 降低 `/api/generate` 的复杂度

### 6.3 场景识别是否需要额外的 LLM 调用？

**决策**：No。仅用规则引擎识别（基于文本特征），不调用 LLM。
- **原因**：规则足够准确，成本低，降低 LLM 调用频率
- **备选**：Phase 3 若场景识别误判率高，再加入 LLM 微调

### 6.4 是否支持多文件上传？

**决策**：支持，但 T11 延后实现。
- **Phase 2**：UI 支持最多 3 个文件，但实现层面先支持单文件处理
- **Phase 2 后期/Phase 3**：实现多文件合并逻辑

---

## 七、交付清单

Phase 2 完成时应交付：

### 代码
- [ ] `src/types/document.ts`：文档类型定义
- [ ] `src/agent/modules/m0-document-parser.ts`：M0 文档解析模块
- [ ] `src/agent/modules/m4-*-outline-generator.ts`：M4 路由和多场景实现
- [ ] `src/agent/prompts/m0-*.ts`：M0 Prompt 集合
- [ ] `src/agent/prompts/m1-intent.ts`（升级版）：支持文档元数据
- [ ] `src/agent/prompts/m4-*.ts`（升级版）：支持多场景
- [ ] `src/agent/orchestrator.ts`（升级版）：集成 M0
- [ ] `src/app/api/parse/route.ts`：文件解析 API
- [ ] `src/app/api/generate/route.ts`（升级版）：支持文件上传
- [ ] `src/components/DocumentUpload.tsx`：文件上传组件
- [ ] `src/components/FilePreview.tsx`：文件预览组件
- [ ] `src/components/InputPanel.tsx`（升级版）：集成文档上传

### 文档
- [ ] 更新 `docs/architecture.md`：补充 M0 模块设计
- [ ] `docs/file-formats-support.md`（新增）：各格式支持说明、限制、最佳实践
- [ ] `docs/phase2-api.md`（新增）：新增 API 文档（`/api/parse`、升级的 `/api/generate`）
- [ ] `docs/scenario-routing.md`（新增）：场景识别算法详解
- [ ] `PROJECT_ROADMAP.md`：更新进度跟踪

### 测试
- [ ] 单元测试：M0 文件解析（覆盖 4 种格式）
- [ ] 集成测试：文件上传 → 解析 → 生成 完整流程
- [ ] 测试数据：`test-data/` 目录，包含各格式示例文件

### 部署
- [ ] 更新 `package.json`：新增依赖（pdf-parse, mammoth）
- [ ] 环境变量文档：若有新配置（如文件上传大小限制）
- [ ] 部署检查清单：新文件上传路径是否正确、临时文件清理等

---

## 八、成功指标

**Phase 2 MVP 完成的定义**：

1. ✅ 用户能上传 PDF / Word / Markdown / TXT 文件
2. ✅ 系统能正确解析文件，提取文本内容
3. ✅ 场景识别准确率 ≥ 80%（A / B / C 分类）
4. ✅ 文档上传后，能生成符合原文档逻辑的 PPT 大纲
5. ✅ 前端 UI 完整，拖拽上传、预览、生成全流程可用
6. ✅ 支持同时上传多个文件（最多 3 个）
7. ✅ 错误处理完整，用户界面无崩溃

**质量指标**：
- 代码覆盖率 ≥ 75%（关键路径）
- 生成延迟 ≤ 40 秒（包含文件解析）
- 错误率 < 5%
- 大纲页数应 ≤ 原文档页数 × 1.5（避免过度扩写）

**用户体验指标**：
- 文件上传成功率 ≥ 95%（正常用户场景）
- 场景识别结果用户可见且可调整
- 错误信息清晰，用户知道该怎么做

---

## 九、后期扩展点（Phase 3+）

- **OCR 支持**：识别扫描 PDF，提取文字
- **表格识别**：提取 Word / PDF 中的表格，融入大纲
- **图片智能分析**：识别文档中的图表，生成配图建议
- **多文件智能合并**：跨文档去重、逻辑整合
- **语言多支持**：非中文文档自动翻译
- **版本管理**：保存用户的上传历史，支持版本对比

---

## 十、附录

### A. 文件格式支持矩阵

| 格式 | 库 | 版本 | 纯文本提取 | 保留格式 | 支持大小 | 备注 |
|------|-----|-----|---------|---------|---------|------|
| PDF | pdf-parse | ^3.2.0 | ✅ | ⚠️ (仅结构) | ≤10MB | 不支持扫描件 |
| DOCX | mammoth | ^1.7.0 | ✅ | ✅ (标题、列表) | ≤10MB | 仅提取纯文本 |
| Markdown | 原生 | - | ✅ | ✅ | ≤10MB | 识别标题结构 |
| TXT | 原生 | - | ✅ | - | ≤10MB | UTF-8 编码 |

### B. 测试文件准备清单

```
test-data/
├── scenario-a/
│   ├── 教学课件.pdf        # 有明确章节、分页
│   ├── 产品白皮书.docx     # 结构化内容
│   └── 项目计划.txt        # 编号列表
├── scenario-b/
│   ├── 技术博客.md         # 主题型散文
│   ├── 案例分析.pdf        # 连贯但无分页
│   └── 自我介绍.txt        # 段落型内容
└── scenario-c/
    ├── 会议笔记.docx       # 杂乱笔记
    └── 内容混合.txt        # 多个话题混合
```

### C. 常见问题 (FAQ)

**Q: 文件多大时会超时？**
A: 单个文件 ≤10MB 通常 < 5 秒解析完成。若超时，检查网络或文件格式。

**Q: 能否上传加密的 PDF？**
A: Phase 2 不支持。用户需解密后重新上传。

**Q: 上传了 3 个文件，生成的大纲页数过多怎么办？**
A: 用户可在前端手动删除某个文件后重新生成。Phase 3 考虑智能合并去重。

**Q: M0 识别错了场景类型怎么办？**
A: 前端显示识别结果，用户可手动调整后生成。后续优化 Prompt。

---

**版本历史**

| 版本 | 日期 | 更新 |
|------|------|------|
| v1.0 | 2026-03-05 | 初版：完整任务拆解、依赖关系、风险评估 |

**下一步行动**

1. 立即：将此计划分享给技术团队，确认资源和时间安排
2. 本周：启动 T1 (库安装) 和 T2 (类型定义)，快速建立基础
3. 下周：启动 T3 (文件解析实现)，并行启动 T7 (前端 UI)
4. 中期检查点（W2 末）：评估 T3/T7 进度，调整计划

