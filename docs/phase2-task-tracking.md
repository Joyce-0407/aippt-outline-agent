# Phase 2 任务跟踪表

**更新时间**：2026-03-05
**负责人**：TBD
**状态**：待启动

---

## 任务全景

```
总计：11 个任务，24.5 小时工作量
状态分布：
  ⭕ 待启动 (11)
  🟡 进行中 (0)
  ✅ 完成 (0)
```

---

## 任务卡片

### T1：依赖库版本规划与安装

| 字段 | 值 |
|------|-----|
| **任务 ID** | T1 |
| **标题** | 依赖库版本规划与安装 |
| **分类** | 基础设施 |
| **优先级** | 🔴 P0 |
| **工作量** | 0.5h |
| **开始日期** | 2026-03-24 (W1) |
| **截止日期** | 2026-03-24 (W1) |
| **状态** | ⭕ 待启动 |
| **负责人** | TBD |
| **前置依赖** | 无 |
| **后置依赖** | T2, T3 |

**完成标准**：
- [ ] pdf-parse 和 mammoth 已加入 package.json
- [ ] npm install 成功执行
- [ ] Node.js REPL 中可成功 import 库

**子任务**：
- [ ] 评估 pdf-parse vs pdfjs-dist → 选择 pdf-parse
- [ ] 评估 mammoth vs docx → 选择 mammoth
- [ ] 执行安装
- [ ] 验证导入

**备注**：
- pdf-parse 如有兼容性问题，备选 pdfjs-dist
- 估计时间：30 分钟

---

### T2：M0 文档解析模块设计与类型定义

| 字段 | 值 |
|------|-----|
| **任务 ID** | T2 |
| **标题** | M0 文档解析模块设计与类型定义 |
| **分类** | 架构设计 |
| **优先级** | 🔴 P0 |
| **工作量** | 2h |
| **开始日期** | 2026-03-24 (W1) |
| **截止日期** | 2026-03-26 (W1) |
| **状态** | ⭕ 待启动 |
| **负责人** | TBD |
| **前置依赖** | T1 |
| **后置依赖** | T3, T4, T5 |

**完成标准**：
- [ ] src/types/document.ts 已创建，包含所有类型定义
- [ ] DocumentParseResult, StructureAnalysis, DocumentMetadata 完整定义
- [ ] src/agent/modules/m0-document-parser.ts 框架已创建，包含完整 JSDoc
- [ ] TypeScript 编译无错误

**子任务**：
- [ ] 定义 DocumentFormat, DocumentParseResult 等类型
- [ ] 定义 StructureAnalysis（场景识别结果）
- [ ] 设计 M0 类结构（parseDocument, analyzeStructure, normalizeText 等方法）
- [ ] 编写详细注释和文档

**关键设计**：
```typescript
// M0 输入
export interface M0Input {
  fileBuffer: Buffer;
  format: DocumentFormat;
  fileName: string;
}

// M0 输出
export interface DocumentParseResult {
  format: DocumentFormat;
  rawText: string;
  metadata: DocumentMetadata;
  structureAnalysis: StructureAnalysis;
}

// 场景识别结果
export interface StructureAnalysis {
  scenarioType: "A" | "B" | "C";
  confidence: number;
  characteristics: { ... };
  reasoning: string;
}
```

**备注**：
- 类型定义是后续所有模块的基础，务必准确
- Phase 1 的 types/outline.ts 等要保持兼容

---

### T3：PDF / Word / Markdown / TXT 文件解析实现

| 字段 | 值 |
|------|-----|
| **任务 ID** | T3 |
| **标题** | 文件解析实现（4 种格式） |
| **分类** | 后端核心 |
| **优先级** | 🔴 P0 |
| **工作量** | 3.5h |
| **开始日期** | 2026-03-25 (W1) |
| **截止日期** | 2026-03-28 (W1) |
| **状态** | ⭕ 待启动 |
| **负责人** | TBD |
| **前置依赖** | T1, T2 |
| **后置依赖** | T4, T5, T6, T8, T9 |

**完成标准**：
- [ ] PDF 解析正常（pdf-parse 集成完成）
- [ ] Word 解析正常（mammoth 集成完成）
- [ ] Markdown / TXT 直接读取实现
- [ ] 场景识别逻辑完整（计算标题比例、列表项等）
- [ ] 所有 4 种格式的测试文件都能成功解析
- [ ] 场景识别准确率 ≥ 80%
- [ ] 错误处理完整（损坏文件、编码错误等）
- [ ] 代码覆盖率 ≥ 80%

**子任务**：
1. **T3.1 PDF 解析**（1h）
   - [ ] pdf-parse 集成
   - [ ] 多页 PDF 处理，记录页数
   - [ ] 错误处理（损坏 PDF、密码保护等）
   - [ ] 测试：sample.pdf 能正确提取文本

2. **T3.2 Word 解析**（1h）
   - [ ] mammoth.extractRawText() 集成
   - [ ] 标题识别逻辑
   - [ ] 错误处理（损坏 .docx 等）
   - [ ] 测试：sample.docx 能正确提取文本

3. **T3.3 Markdown / TXT 解析**（0.5h）
   - [ ] fs.readFileSync 实现
   - [ ] 编码检测（utf-8 / gbk）
   - [ ] Markdown 标题结构识别（# ## ###）
   - [ ] 测试：sample.md / sample.txt 能正确读取

4. **T3.4 场景识别逻辑**（1h）
   - [ ] 计算标题行占比 → A 的指标
   - [ ] 计算列表项数量 → A 的指标
   - [ ] 计算分页符数量 → A 的指标
   - [ ] 生成 reasoning 字段说明
   - [ ] 手动测试：3-5 个示例文档，准确率 ≥ 80%

**测试数据准备**：
```
test-data/
├── scenario-a/
│   ├── 教学课件.pdf        # 明确章节、分页
│   ├── 产品白皮书.docx
│   └── 项目计划.txt
├── scenario-b/
│   ├── 技术博客.md
│   ├── 案例分析.pdf
│   └── 自我介绍.txt
└── scenario-c/
    ├── 会议笔记.docx
    └── 混合内容.txt
```

**关键算法**（场景识别）：
```typescript
analyzeStructure(text: string): StructureAnalysis {
  const lines = text.split('\n');
  const titleCount = lines.filter(l => /^#{1,6}\s/.test(l) || /^[A-Z\d]+\s*$/.test(l)).length;
  const listCount = lines.filter(l => /^\s*[-\d.]\s/.test(l)).length;
  const pageBreakCount = text.split('\f').length - 1;

  const isStructured = titleCount / lines.length > 0.1 || pageBreakCount > 2 || listCount > 5;

  return {
    scenarioType: isStructured ? "A" : "B",
    confidence: Math.min(titleCount + listCount + pageBreakCount * 2) / 10,
    ...
  };
}
```

**备注**：
- 这是 Phase 2 的核心任务，务必高质量完成
- W1 末完成后，立即用真实文件测试，识别问题早调整

---

### T4：M1 意图分析模块升级（支持文档内容）

| 字段 | 值 |
|------|-----|
| **任务 ID** | T4 |
| **标题** | M1 意图分析模块升级 |
| **分类** | 后端核心 |
| **优先级** | 🔴 P0 |
| **工作量** | 1.5h |
| **开始日期** | 2026-03-27 (W1) |
| **截止日期** | 2026-04-01 (W2) |
| **状态** | ⭕ 待启动 |
| **负责人** | TBD |
| **前置依赖** | T3 |
| **后置依赖** | T8, T9, T10 |

**完成标准**：
- [ ] M1 可接受 documentMetadata 和 scenarioType 参数
- [ ] Prompt 已升级，能识别场景类型
- [ ] 手动测试：同一主题，文档输入 vs 文字输入，结果差异明显
- [ ] 代码编译无错误，类型检查通过

**改造点**：
1. **扩展 M1 输入类型**
   ```typescript
   export interface IntentAnalysisInput {
     userInput: string;
     documentMetadata?: DocumentMetadata;
     scenarioType?: "A" | "B" | "C";
   }
   ```

2. **升级 M1 Prompt**（见 T8）
   - 增加对文档元信息的考虑
   - 针对场景 A，提示保留原结构
   - 针对场景 C，提示强化梳理

3. **集成 Orchestrator**
   - Orchestrator 接收可选 `documentParseResult`
   - 若有文档，先调用 M0，再传结果给 M1
   - 若无文档，走 Phase 1 流程

**关键更改**：
```typescript
// 原 orchestrator.ts
async generate(userInput, llmConfig) {
  const intent = await m1.analyze(userInput);
  ...
}

// 升级后 orchestrator.ts
async generate(userInput, llmConfig, documentParseResult?) {
  const intent = await m1.analyze({
    userInput,
    documentMetadata: documentParseResult?.metadata,
    scenarioType: documentParseResult?.structureAnalysis.scenarioType
  });
  ...
}
```

**备注**：
- M1 的核心逻辑保持不变，只是输入扩展
- Prompt 调整见 T8

---

### T5：M4 大纲生成模块升级（支持场景 A 还原）

| 字段 | 值 |
|------|-----|
| **任务 ID** | T5 |
| **标题** | M4 大纲生成模块升级与路由 |
| **分类** | 后端核心 |
| **优先级** | 🔴 P0 |
| **工作量** | 2.5h |
| **开始日期** | 2026-03-27 (W1) |
| **截止日期** | 2026-04-01 (W2) |
| **状态** | ⭕ 待启动 |
| **负责人** | TBD |
| **前置依赖** | T3 |
| **后置依赖** | T8, T9, T10 |

**完成标准**：
- [ ] M4 能接收并识别 scenarioType 参数
- [ ] 针对 A（结构化）和 B（主题型）分别调用不同生成逻辑
- [ ] 手动测试：结构化文档 (A) 输入，生成结果保留原结构
- [ ] 代码编译无错误，类型检查通过
- [ ] M4B 逻辑与 Phase 1 保持兼容

**改造点**：

1. **M4 路由逻辑**
   ```typescript
   async generateOutline(
     userInput,
     intent,
     storyline,
     scenarioType: "A" | "B" | "C" = "B"
   ) {
     switch (scenarioType) {
       case "A":
         return generateOutlineFromStructure(...);
       case "B":
         return generateOutlineFromTheme(...);
       case "C":
         return generateOutlineFromScatter(...);
     }
   }
   ```

2. **M4A 结构还原逻辑**（新增）
   - Prompt：优先提取原文档大纲框架
   - 对每一段，保留核心信息，补充细节
   - 生成结果页数 ≈ 原文档逻辑页数
   - Prompt 见 T8

3. **M4B 主题扩写逻辑**（既有）
   - 保持 Phase 1 逻辑完全不变
   - 作为 A/C 的备选

4. **M4C 散乱重组逻辑**（暂不实现）
   - Phase 2 暂不实现，预留接口

**关键设计**：
```typescript
// M4 新增方法
private async generateOutlineFromStructure(
  userInput: string,
  intent: IntentAnalysis,
  storyline: Storyline
): Promise<PPTOutline> {
  // 用 M4A 专用 Prompt
  // 优先保留原结构
}

private async generateOutlineFromTheme(
  userInput: string,
  intent: IntentAnalysis,
  storyline: Storyline
): Promise<PPTOutline> {
  // Phase 1 既有逻辑
}
```

**备注**：
- M4A 是新增核心功能，需要专门调试 Prompt
- 确保 M4B 与 Phase 1 完全兼容，不破坏既有流程

---

### T6：API 路由升级（支持 multipart/form-data 文件上传）

| 字段 | 值 |
|------|-----|
| **任务 ID** | T6 |
| **标题** | API 路由升级 |
| **分类** | 后端 API |
| **优先级** | 🔴 P0 |
| **工作量** | 2h |
| **开始日期** | 2026-03-31 (W2) |
| **截止日期** | 2026-04-02 (W2) |
| **状态** | ⭕ 待启动 |
| **负责人** | TBD |
| **前置依赖** | T3, T4, T5 |
| **后置依赖** | T9, T10 |

**完成标准**：
- [ ] `/api/parse` 路由已创建，可接收单个文件
- [ ] `/api/parse` 返回 DocumentParseResult JSON
- [ ] `/api/generate` 已升级，支持 multipart/form-data
- [ ] `/api/generate` 支持 userInput（Phase 1 既有）或 file 或两者
- [ ] 错误处理完整（文件过大、格式不支持等）
- [ ] 集成测试通过（curl / Postman 验证）

**实现方案**：

1. **新增 `/api/parse` 路由**
   ```typescript
   // POST /api/parse
   // 请求：multipart/form-data，包含 file（单个文件）
   // 响应：JSON
   // {
   //   "documentParseResult": DocumentParseResult
   // }
   ```

   实现：
   - 接收 FormData
   - 提取 file 字段
   - 调用 M0.parseDocument()
   - 返回解析结果

2. **升级 `/api/generate` 路由**
   ```typescript
   // POST /api/generate
   // 请求体可包含：
   //   - userInput (string) + llmConfig （Phase 1 既有）
   //   - file (multipart) + llmConfig （新增）
   //   - 两者都有时，合并内容
   // 响应：SSE 流，格式同 Phase 1
   ```

   实现：
   - 判断是否为 multipart
   - 若是，提取 file，调用 M0
   - 若否，沿用 Phase 1 逻辑
   - 若两者都有，合并文本内容
   - 传给 orchestrator

3. **文件大小限制**
   - 单个文件 ≤ 10MB
   - 返回错误：400 "FILE_TOO_LARGE"

4. **格式检验**
   - 检查 MIME 类型（application/pdf, etc）
   - 检查文件扩展名
   - 不匹配时返回 400 "UNSUPPORTED_FORMAT"

**关键代码框架**：
```typescript
// app/api/parse/route.ts
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) return badRequest('FILE_REQUIRED');
    if (file.size > 10 * 1024 * 1024) return badRequest('FILE_TOO_LARGE');

    const buffer = await file.arrayBuffer();
    const format = detectFormat(file.name, file.type);

    const parser = new DocumentParser();
    const result = await parser.parseDocument(
      Buffer.from(buffer),
      format,
      file.name
    );

    return Response.json({ documentParseResult: result });
  } catch (error) {
    return serverError(error);
  }
}

// app/api/generate/route.ts (升级)
export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    // 文件上传路径
    const formData = await request.formData();
    const file = formData.get('file');
    const llmConfigStr = formData.get('llmConfig');
    // ... 解析、调用 M0、SSE
  } else {
    // Phase 1 既有路径（JSON）
    const { userInput, llmConfig } = await request.json();
    // ... 直接 SSE
  }
}
```

**备注**：
- 确保 SSE 响应格式与 Phase 1 完全兼容
- 错误处理要友好，用户知道该怎么做

---

### T7：前端文档上传 UI 组件

| 字段 | 值 |
|------|-----|
| **任务 ID** | T7 |
| **标题** | 前端文档上传 UI 组件 |
| **分类** | 前端 |
| **优先级** | 🔴 P0 |
| **工作量** | 3h |
| **开始日期** | 2026-03-31 (W2) |
| **截止日期** | 2026-04-04 (W2) |
| **状态** | ⭕ 待启动 |
| **负责人** | TBD |
| **前置依赖** | T6 |
| **后置依赖** | T10 |

**完成标准**：
- [ ] DocumentUpload 组件已创建，支持拖拽 + 点击
- [ ] 支持多文件（最多 3 个）
- [ ] 文件队列显示正确
- [ ] FilePreview 组件已创建，支持删除和预览
- [ ] 样式美观，响应式布局（手机适配）
- [ ] 无 UI 错误，用户体验清晰

**核心组件**：

1. **DocumentUpload 组件**
   ```typescript
   // components/DocumentUpload.tsx
   interface DocumentUploadProps {
     maxFiles?: number;        // 默认 3
     maxFileSize?: number;     // 默认 10MB
     onFilesSelected?: (files: File[]) => void;
   }

   // 功能：
   // - 拖拽区域（显示"拖拽文件到此"）
   // - 点击选择文件
   // - 支持 PDF / DOCX / MD / TXT
   // - 文件队列显示
   // - 解析按钮触发 /api/parse
   ```

2. **FilePreview 组件**
   ```typescript
   // components/FilePreview.tsx
   interface FilePreviewProps {
     files: DocumentParseResult[];
     onRemove?: (index: number) => void;
   }

   // 功能：
   // - 显示文件名、大小、格式
   // - 显示场景类型（A/B/C）和置信度
   // - 显示文本摘要（前 200 字）
   // - 删除按钮
   ```

3. **InputPanel 升级**（集成新组件）
   ```typescript
   // components/InputPanel.tsx (升级)
   // 原有：文本输入框
   // 新增：Tab 切换
   //   - Tab 1: 文字输入（Phase 1）
   //   - Tab 2: 文档上传（Phase 2）
   //   或并行显示（推荐）
   ```

**交互流程**：
1. 用户选择上传文件 → DocumentUpload 显示文件列表和进度
2. 点击「解析」→ 调用 `/api/parse`
3. 解析完成 → FilePreview 显示场景类型、文本摘要
4. 用户可删除文件或继续添加
5. 点击「生成大纲」→ 调用 `/api/generate`，传入文件 + userInput + llmConfig
6. 前端展示 SSE 进度（同 Phase 1）

**样式建议**：
- 拖拽区域：虚线边框，中心显示图标和提示文案
- 文件队列：Card 列表，显示文件名、大小、状态
- 场景类型：Badge 显示（A / B / C），同时显示 reasoning
- 错误提示：红色文案，清晰说明（如"文件太大，请上传 ≤10MB 的文件"）
- 响应式：手机上拖拽区域宽度 100%，Card 宽度自适应

**关键状态管理**：
```typescript
const [files, setFiles] = useState<File[]>([]);
const [parseResults, setParseResults] = useState<DocumentParseResult[]>([]);
const [parseLoading, setParseLoading] = useState(false);
const [parseError, setParseError] = useState('');

const handleFilesSelected = async (newFiles: File[]) => {
  // 校验
  // 调用 /api/parse
  // 更新 parseResults
};
```

**备注**：
- T7 和 T10 紧密关联，UI 实现后需与 API 集成测试
- 确保手机浏览器也能正常使用

---

### T8：Prompt 设计与测试（M0 / M1 / M4 升级）

| 字段 | 值 |
|------|-----|
| **任务 ID** | T8 |
| **标题** | Prompt 设计与测试 |
| **分类** | Prompt 工程 |
| **优先级** | 🔴 P0 |
| **工作量** | 3h |
| **开始日期** | 2026-04-02 (W2) |
| **截止日期** | 2026-04-07 (W3) |
| **状态** | ⭕ 待启动 |
| **负责人** | TBD |
| **前置依赖** | T3, T4, T5 |
| **后置依赖** | T9, T10 |

**完成标准**：
- [ ] M0 Prompt 已编写，JSON 输出格式正确
- [ ] M1 Prompt 已升级，能识别 documentMetadata 和 scenarioType
- [ ] M4A Prompt 已编写（结构还原），M4B Prompt 已验证（主题扩写）
- [ ] 至少 3-5 个测试用例通过，准确率 ≥ 80%
- [ ] 记录 Prompt 迭代日志（包括调整原因）

**涉及文件**：
- `src/agent/prompts/m0-document-analysis.ts`（新增）
- `src/agent/prompts/m1-intent.ts`（升级）
- `src/agent/prompts/m4-outline.ts`（升级，拆分为 m4-outline-from-structure.ts）

**Prompt 内容**：

1. **M0 Prompt 模板**（新增）
   ```
   你是文档结构分析专家。

   以下是用户上传的文档内容：

   【文档内容】
   {rawText}

   【文档元数据】
   格式：{format}
   文件名：{fileName}
   总字数：{totalCharacters}

   请分析该文档的结构类型，并返回 JSON：
   {
     "scenarioType": "A" | "B" | "C",
     "confidence": 0.7,
     "reasoning": "该文档包含明确的章节标题和分页标记..."
   }

   分类标准：
   - A（结构化）：有明确章节标题、分页符、编号列表等
   - B（主题型）：围绕一个主题展开，但缺少明确分页或结构
   - C（散乱）：无明确逻辑或混合多个主题
   ```

2. **M1 Prompt 升级**（条件分支）
   ```
   ...（原有 M1 Prompt）...

   【文档信息】
   {#if documentMetadata}
   源自文档：{documentMetadata.fileName}
   文档格式：{documentMetadata.format}
   文档结构类型：{scenarioType}
   {/if}

   请基于以上信息分析 PPT 用途、受众等...
   ```

3. **M4A Prompt**（结构还原，新增）
   ```
   你是 PPT 大纲设计专家。

   原文档是结构化的，包含明确的章节和逻辑。

   用户输入：{userInput}
   意图分析：{intent}
   故事线：{storyline}

   请基于原文档的结构，生成 PPT 大纲。优先保留原文档的逻辑框架，
   对每个章节补充详细内容、要点和数据。

   返回 JSON：
   {
     "meta": { ... },
     "pages": [ ... ]
   }
   ```

4. **M4B Prompt**（主题扩写，既有）
   ```
   ...（Phase 1 既有，保持不变）...
   ```

**测试计划**：

| 测试用例 | 输入文档 | 预期场景 | 实际结果 | 通过 |
|---------|---------|---------|---------|------|
| TC1 | test-data/scenario-a/教学课件.pdf | A | ? | ⭕ |
| TC2 | test-data/scenario-b/技术博客.md | B | ? | ⭕ |
| TC3 | test-data/scenario-c/会议笔记.docx | B 或 C | ? | ⭕ |
| TC4 | 同一主题，文字输入 vs 文档输入 | 结果差异明显 | ? | ⭕ |
| TC5 | 结构化文档生成的大纲保留原结构 | M4A 逻辑正确 | ? | ⭕ |

**迭代流程**：
1. 编写初版 Prompt
2. 手动测试 3-5 个用例
3. 根据结果调整 Prompt
4. 记录调整日志（如"增加了对标题的识别提示"）
5. 重复直到准确率 ≥ 80%

**备注**：
- Prompt 调试是最耗时的，预留充足时间
- 保留所有测试用例和迭代日志，便于后续优化

---

### T9：文档上传 API 集成测试

| 字段 | 值 |
|------|-----|
| **任务 ID** | T9 |
| **标题** | 文档上传 API 集成测试 |
| **分类** | 测试 |
| **优先级** | 🔴 P0 |
| **工作量** | 1.5h |
| **开始日期** | 2026-04-07 (W3) |
| **截止日期** | 2026-04-09 (W3) |
| **状态** | ⭕ 待启动 |
| **负责人** | TBD |
| **前置依赖** | T3, T6, T8 |
| **后置依赖** | T10 |

**完成标准**：
- [ ] 单元测试：M0 解析模块各格式正确率 ≥ 95%
- [ ] 集成测试：/api/parse 端点可用
- [ ] 集成测试：/api/generate 支持文件上传
- [ ] E2E 测试：至少 3 个完整流程成功（文件 → 解析 → 生成）
- [ ] 边界测试：超大文件、损坏文件、空文件都有合理错误提示
- [ ] 所有测试记录在文档或 PR 中

**测试套件**：

1. **单元测试：M0 解析**
   ```typescript
   // tests/m0-document-parser.test.ts

   describe('DocumentParser', () => {
     it('should parse PDF correctly', async () => { ... });
     it('should parse DOCX correctly', async () => { ... });
     it('should parse Markdown correctly', async () => { ... });
     it('should parse TXT correctly', async () => { ... });
     it('should identify scenario A', async () => { ... });
     it('should identify scenario B', async () => { ... });
     it('should handle corrupted files', async () => { ... });
   });
   ```

2. **集成测试：/api/parse**
   ```typescript
   // tests/api-parse.test.ts

   describe('POST /api/parse', () => {
     it('should parse uploaded file and return result', async () => {
       const file = new File(['...'], 'test.pdf');
       const res = await fetch('/api/parse', {
         method: 'POST',
         body: new FormData().append('file', file)
       });
       expect(res.status).toBe(200);
       const { documentParseResult } = await res.json();
       expect(documentParseResult.format).toBe('pdf');
       expect(documentParseResult.structureAnalysis.scenarioType).toBeDefined();
     });

     it('should reject file too large', async () => {
       // ...
       expect(res.status).toBe(400);
     });
   });
   ```

3. **集成测试：/api/generate**
   ```typescript
   // tests/api-generate.test.ts

   describe('POST /api/generate', () => {
     it('should support file upload (multipart)', async () => {
       // ...
       const res = await fetch('/api/generate', {
         method: 'POST',
         body: new FormData()
           .append('file', file)
           .append('llmConfig', JSON.stringify(llmConfig))
       });
       expect(res.status).toBe(200);
       // 验证 SSE 流
     });

     it('should support text input (JSON) - Phase 1 流程', async () => {
       // ...
     });

     it('should support mixed input (text + file)', async () => {
       // ...
     });
   });
   ```

4. **E2E 测试（手动）**
   | 用例 | 步骤 | 预期 | 结果 |
   |------|------|------|------|
   | E2E-1 | 上传 PDF (A) → 解析 → 生成 | 生成大纲保留原结构，页数合理 | ⭕ |
   | E2E-2 | 上传 DOCX (B) → 解析 → 生成 | 生成大纲逻辑清晰，主题突出 | ⭕ |
   | E2E-3 | 上传 Markdown (B) → 解析 → 生成 | 生成大纲包含原文档的关键点 | ⭕ |

5. **边界测试**
   - [ ] 超大文件（>10MB）→ 返回 400，提示"文件过大"
   - [ ] 损坏的 PDF → 返回 500，提示"文件解析失败"
   - [ ] 空文件 → 返回 400，提示"文件为空"
   - [ ] 不支持的格式（.xlsx） → 返回 400，提示"不支持的文件格式"

**测试数据**：
```
test-data/
├── scenario-a/教学课件.pdf        # PDF，预期 A
├── scenario-b/技术博客.md         # Markdown，预期 B
└── scenario-c/会议笔记.docx       # Word，预期 B/C

edge-cases/
├── empty.txt                       # 空文件
├── corrupted.pdf                   # 损坏的 PDF
├── large-file.pdf                  # >10MB
└── unsupported.xlsx                # 不支持的格式
```

**执行**：
1. 编写单元测试，确保 M0 正常工作
2. 编写集成测试，验证 API 端点
3. 手动测试 3 个 E2E 用例
4. 记录所有结果在 test-report.md

**备注**：
- 测试是质量保证，不能跳过
- 如发现问题，返回 T3 / T6 修复，再重新测试

---

### T10：前端文档上传 UI 集成与优化

| 字段 | 值 |
|------|-----|
| **任务 ID** | T10 |
| **标题** | 前端 UI 集成与优化 |
| **分类** | 前端 |
| **优先级** | 🔴 P0 |
| **工作量** | 2h |
| **开始日期** | 2026-04-07 (W3) |
| **截止日期** | 2026-04-09 (W3) |
| **状态** | ⭕ 待启动 |
| **负责人** | TBD |
| **前置依赖** | T7, T9 |
| **后置依赖** | 无 |

**完成标准**：
- [ ] 从上传到生成结果的整个流程 UI 无错误
- [ ] 手机浏览器上也能正常使用
- [ ] 错误提示清晰，用户知道该怎么做
- [ ] 代码审查通过，无性能问题

**集成内容**：

1. **页面流程集成**
   - InputPanel + DocumentUpload 并列（或 Tab 切换）
   - 文件上传 → 调用 /api/parse → FilePreview 显示结果
   - 用户确认 → 调用 /api/generate → SSE 展示进度（同 Phase 1）

2. **状态管理完善**
   ```typescript
   // 上传中 → 解析中 → 生成中 → 完成
   const [uploadState, setUploadState] = useState('idle' | 'uploading' | 'parsing' | 'generating' | 'done' | 'error');
   const [parseResults, setParseResults] = useState<DocumentParseResult[]>([]);
   const [generatingOutline, setGeneratingOutline] = useState<PPTOutline | null>(null);
   ```

3. **UI 优化**
   - 加载动画：展示 spinner + 文案"解析中..."
   - 骨架屏：显示 FilePreview 的加载状态
   - 错误处理：红色提示文案 + 重试按钮
   - 文件预览：显示场景类型、文本摘要（前 200 字）

4. **用户引导**
   - 首次使用的提示文案（如"支持 PDF、Word、Markdown、TXT 文件"）
   - 文件大小限制说明（"单个文件 ≤10MB"）
   - 场景类型的解释（A / B / C 含义，用气泡图标显示）
   - 成功提示（"解析完成，请点击「生成大纲」"）

5. **流程 UX**
   - 用户可在不上传的情况下，仍用文字输入走 Phase 1 流程
   - 用户可混合使用文本 + 文件（输入框和上传框并行）
   - 用户可轻松删除已上传文件后重新上传

**关键代码框架**：
```typescript
// app/page.tsx (集成)
export default function Home() {
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [userInput, setUserInput] = useState('');
  const [parseResults, setParseResults] = useState<DocumentParseResult[]>([]);
  const [generating, setGenerating] = useState(false);
  const [outlineResult, setOutlineResult] = useState<PPTOutline | null>(null);

  const handleFilesSelected = async (files: File[]) => {
    // 调用 /api/parse
    // 更新 parseResults
  };

  const handleGenerate = async () => {
    const finalInput = userInput + (parseResults.map(r => r.rawText).join('\n\n'));
    // 调用 /api/generate，传入 file + userInput + llmConfig
    // 处理 SSE，显示进度
  };

  return (
    <div>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab label="文字输入">
          <InputPanel ... />
        </Tab>
        <Tab label="文档上传">
          <DocumentUpload onFilesSelected={handleFilesSelected} />
          {parseResults.length > 0 && (
            <FilePreview files={parseResults} onRemove={...} />
          )}
        </Tab>
      </Tabs>

      <OutlineDisplay outline={outlineResult} />
    </div>
  );
}
```

**手机适配**：
- 拖拽区域宽度 100%，高度自适应
- Card 宽度 100%，内容使用 px 确保可读
- 按钮宽度 100%，点击区域 ≥ 44px
- 文字大小 ≥ 16px（避免缩放）

**备注**：
- T10 是 Phase 2 的最后一步，直接影响用户体验
- 务必充分测试，确保流程顺畅

---

### T11：文档合并与内容处理（可选优化）

| 字段 | 值 |
|------|-----|
| **任务 ID** | T11 |
| **标题** | 多文件合并与内容处理 |
| **分类** | 可选功能 |
| **优先级** | 🟡 P1 |
| **工作量** | 1.5h |
| **开始日期** | 2026-04-10 (W3 后) |
| **截止日期** | 2026-04-11 (W3 后) |
| **状态** | ⭕ 待启动（可延后） |
| **负责人** | TBD |
| **前置依赖** | T10 |
| **后置依赖** | 无 |

**完成标准**（如启动）：
- [ ] 用户可同时上传 2-3 个文件
- [ ] 系统能合并多个文档的内容
- [ ] 生成大纲的页数合理（不过多）
- [ ] 合并逻辑清晰，无内容混乱

**功能描述**：

用户可同时上传最多 3 个文件，系统按上传顺序拼接内容，生成一份综合大纲。

**实现**：
1. 前端支持最多 3 个文件上传（UI 已支持）
2. 后端 /api/parse 接收多个文件，返回多个 DocumentParseResult
3. /api/generate 接收多个文件，按顺序拼接文本内容，调用 orchestrator
4. M1 分析意图时，考虑多文档的综合主题
5. M4 生成大纲时，可选是否合并去重

**优化方向**（Phase 3）：
- 内容去重：识别重复内容，避免多次提及
- 逻辑整合：跨文档的内容排序和衔接
- 分文档大纲：为每个文件生成独立大纲后合并

**风险**：
- 合并多个文档时，内容可能混乱或重复过多
- 生成大纲页数可能超过预期

**备注**：
- T11 是锦上添花功能，**可延后到 Phase 2 中期或 Phase 3**
- 若时间紧张，可跳过，不影响 Phase 2 MVP 验收

---

## 进度跟踪

### 周进度

#### W1 (3/24-3/28)

| 任务 | 计划工时 | 实际工时 | 状态 | 备注 |
|------|---------|---------|------|------|
| T1 | 0.5h | - | ⭕ | 待启动 |
| T2 | 2h | - | ⭕ | 待启动 |
| T3 | 3.5h | - | ⭕ | 待启动 |
| **小计** | **6h** | - | **⭕** | - |

**检查点**：
- [ ] W1 末：T1-T3 全部完成
- [ ] T3 已用真实文件测试，识别准确率 ≥ 80%
- [ ] 代码审查通过

#### W2 (3/31-4/4)

| 任务 | 计划工时 | 实际工时 | 状态 | 备注 |
|------|---------|---------|------|------|
| T4 | 1.5h | - | ⭕ | 依赖 T3 |
| T5 | 2.5h | - | ⭕ | 依赖 T3 |
| T6 | 2h | - | ⭕ | 依赖 T3 |
| T7 | 3h | - | ⭕ | 依赖 T6 |
| T8 (部分) | 1.5h | - | ⭕ | 依赖 T4-T7 |
| **小计** | **10.5h** | - | **⭕** | - |

**检查点**：
- [ ] W2 末：T4-T8 大部分完成
- [ ] /api/parse 和 /api/generate 都支持文件上传
- [ ] DocumentUpload 组件可用
- [ ] 手动测试：单个文件从上传到 API 调用可用

#### W2-W3 (4/1-4/4)

| 任务 | 计划工时 | 实际工时 | 状态 | 备注 |
|------|---------|---------|------|------|
| T8 (续) | 1.5h | - | ⭕ | Prompt 调试 |
| T9 | 1.5h | - | ⭕ | 依赖 T8 |
| T10 | 2h | - | ⭕ | 依赖 T7, T9 |
| **小计** | **5h** | - | **⭕** | - |

**检查点**：
- [ ] T8 完成：Prompt 测试用例通过
- [ ] T9 完成：集成测试覆盖 4 种格式，准确率 ≥ 80%
- [ ] T10 完成：前端流程串联，E2E 可用

#### W3 (4/7-4/11)

| 任务 | 计划工时 | 实际工时 | 状态 | 备注 |
|------|---------|---------|------|------|
| T11 (可选) | 1.5h | - | ⭕ | 可延后 |
| 文档完善 | 1h | - | ⭕ | API 文档、部署指南 |
| **小计** | **2.5h** | - | **⭕** | - |

**检查点**：
- [ ] T11 (可选)：如启动，多文件合并可用
- [ ] 文档齐全，README / API 文档更新
- [ ] 最终测试：5 个端到端用例通过
- [ ] 代码 push，PR 提交

---

## 常见问题 (FAQ)

**Q: 如果某个库不兼容怎么办？**
A: 立即评估备选方案（见技术决策章节）。例如 pdf-parse 失效，换 pdfjs-dist。不要浪费时间反复尝试。

**Q: Prompt 调试需要多久？**
A: 通常 2-3h 可达到 80% 准确率。如果超过 4h，考虑降低目标（如改为 70%）或简化场景（如只支持 A/B）。

**Q: 是否必须支持多文件上传？**
A: Phase 2 MVP 只需要单文件支持。T11 (多文件合并) 是 P1，可延后。

**Q: 文件大小限制为什么是 10MB？**
A: 平衡用户体验和服务器成本。如需更大，Phase 3 实现分块上传。

**Q: 如果时间不足怎么办？**
A: 优先级顺序（不能砍）：
   1. T1-T3 (基础)
   2. T4-T6 (核心)
   3. T7-T10 (前端)
   4. T11 (可选)

---

**版本历史**

| 版本 | 日期 | 更新 |
|------|------|------|
| v1.0 | 2026-03-05 | 初版：11 个任务卡片、执行计划、FAQ |

