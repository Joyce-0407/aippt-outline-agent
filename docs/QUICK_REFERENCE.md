# Phase 2 快速参考卡

**打印这个卡片，贴在工位上。** 快速查阅关键信息，无需打开长文档。

---

## 核心数字

```
总工时：24.5 小时
周期：3 周（2026-03-24 ~ 2026-04-11）
任务数：11 个（T1-T11）
新增模块：3 个（M0 + API + 前端 UI）
升级模块：3 个（M1 + M4 + Orchestrator）
```

---

## 11 个任务一览表

| ID | 任务 | 工时 | 周 | 依赖 | 优先级 |
|----|------|------|-----|------|--------|
| **T1** | 库安装 | 0.5h | W1 | 无 | 🔴 P0 |
| **T2** | 类型定义 | 2h | W1 | T1 | 🔴 P0 |
| **T3** | 文件解析 | 3.5h | W1 | T2 | 🔴 P0 |
| **T4** | M1 升级 | 1.5h | W2 | T3 | 🔴 P0 |
| **T5** | M4 升级 | 2.5h | W2 | T3 | 🔴 P0 |
| **T6** | API 升级 | 2h | W2 | T5 | 🔴 P0 |
| **T7** | 前端 UI | 3h | W2 | T6 | 🔴 P0 |
| **T8** | Prompt 调试 | 3h | W2-W3 | T4-T7 | 🔴 P0 |
| **T9** | 集成测试 | 1.5h | W3 | T8 | 🔴 P0 |
| **T10** | UI 集成 | 2h | W3 | T7-T9 | 🔴 P0 |
| **T11** | 多文件合并 | 1.5h | W3+ | T10 | 🟡 P1 |

**关键路径**：T1 → T2 → T3 → T4/T5 → T8 → T9 → T10

---

## 场景识别（A / B / C）

```
用户上传文档
         ↓
    M0 解析
         ↓
   场景识别
    /  |  \
   /   |   \
  A    B    C
```

| 场景 | 特征 | M4 策略 | 示例 |
|------|------|--------|------|
| **A** | 有章节、分页符、编号列表 | 结构还原 | 教材、白皮书 |
| **B** | 围绕主题，但散乱 | 主题扩写 | 博客、案例 |
| **C** | 完全无序、混合话题 | 散乱重组 | 笔记、混合素材 |

**识别准确率目标**：≥ 80%

---

## 新增 / 升级文件速查

### 新增文件

```
src/types/document.ts
├─ DocumentFormat
├─ DocumentParseResult
├─ DocumentMetadata
└─ StructureAnalysis

src/agent/modules/m0-document-parser.ts
├─ DocumentParser 类
├─ parseDocument()
├─ analyzeStructure()
└─ normalizeText()

src/app/api/parse/route.ts
└─ POST /api/parse → DocumentParseResult

src/components/DocumentUpload.tsx
├─ 拖拽上传
├─ 点击选择
└─ 文件队列

src/components/FilePreview.tsx
├─ 文件列表
└─ 场景展示
```

### 升级文件

```
src/agent/prompts/m1-intent.ts
└─ 支持 documentMetadata 和 scenarioType

src/agent/modules/m4-outline-generator.ts
├─ 路由逻辑（A/B/C）
└─ M4A 结构还原

src/agent/orchestrator.ts
└─ 集成 M0 解析

src/app/api/generate/route.ts
└─ 支持 multipart/form-data

src/components/InputPanel.tsx
└─ 集成 DocumentUpload
```

---

## 库选型

```
PDF     → pdf-parse (轻量) | 备选: pdfjs-dist (功能强)
Word    → mammoth (成熟稳定)
Markdown → 原生 fs.readFileSync (无依赖)
TXT     → 原生 fs.readFileSync (无依赖)
```

**命令**：`npm install pdf-parse mammoth`

---

## API 端点速查

### 新增

```bash
POST /api/parse
请求：multipart/form-data { file }
响应：{ documentParseResult: DocumentParseResult }
```

### 升级

```bash
POST /api/generate

# 方案 1：纯文本（Phase 1）
请求：{ userInput, llmConfig }

# 方案 2：文件上传（Phase 2 新增）
请求：multipart/form-data { file, llmConfig }

# 方案 3：混合（推荐）
请求：multipart/form-data { file, userInput, llmConfig }

响应：SSE 流（格式同 Phase 1）
```

---

## 周进度 Checklist

### W1 末应完成

- [ ] T1：npm install 成功
- [ ] T2：types/document.ts 完整
- [ ] T3：4 种文件格式都能解析，场景识别准确率 ≥ 80%
- [ ] 用真实文件测试，发现问题早调整

### W2 末应完成

- [ ] T4-T6 全部完成，代码审查通过
- [ ] /api/parse 和升级后的 /api/generate 都支持文件上传
- [ ] DocumentUpload 组件可用
- [ ] 手动测试：文件上传 → API 调用 完整流程

### W3 末应完成

- [ ] T8 Prompt 迭代完成，测试用例通过
- [ ] T9 集成测试通过，至少 3 个 E2E 流程成功
- [ ] T10 前端流程集成，无 UI 错误
- [ ] 最终代码审查，提交 PR

---

## 风险 & 应对（一页纸版本）

| # | 风险 | 概率 | 应对 |
|----|------|------|------|
| 1 | PDF/Word 解析失效 | 🔴 高 | W1 末用真实文件测试；推荐纯文本 PDF |
| 2 | 场景识别误判 | 🟡 中 | 前端显示结果，用户可手动修改 |
| 3 | 文件超时 | 🟡 中 | 限制 ≤10MB；显示进度；Phase 3 分块 |

**关键行动**：W1 末立即用真实文件测试，发现问题早调整。

---

## 成功指标（验收清单）

### 技术

- [ ] 支持 PDF / Word / Markdown / TXT 上传
- [ ] 场景识别准确率 ≥ 80%
- [ ] 文档生成的大纲逻辑与原文档一致
- [ ] 代码覆盖率 ≥ 75%（关键路径）

### 用户体验

- [ ] 拖拽上传可用，反馈清晰
- [ ] 上传到生成 < 60 秒
- [ ] 错误提示有用，用户知道如何解决

### 代码质量

- [ ] 无严重错误，可部署生产
- [ ] 文档完整，易于维护
- [ ] 测试覆盖率 ≥ 75%

---

## 文档导航

```
需要快速了解？
→ docs/phase2-exec-summary.md (5 分钟)

需要完整理解？
→ docs/phase2-plan.md (30 分钟)

需要执行指导？
→ docs/phase2-task-tracking.md (按任务查看)

找不到东西？
→ docs/PHASE2_README.md (导航指南)
```

---

## 今天就做这三件事

1. **分享计划**（10 分钟）
   - 发送 phase2-exec-summary.md 给团队

2. **准备测试数据**（本周）
   - 创建 test-data/ 文件夹，放入 3-5 个示例文档

3. **启动 W1**（本周末）
   - T1: npm install
   - T2: 类型定义
   - T3: 文件解析实现

---

**打印并贴于工位。定期对照 Checklist 更新进度。**

最后更新：2026-03-05

