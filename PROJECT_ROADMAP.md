# AIPPT 大纲生成 Agent - 项目管控体系

**项目名称**：AIPPT 大纲生成 Agent
**项目负责人**：senior-dev-executor
**状态更新时间**：2026-03-04
**当前阶段**：Phase 1 MVP - 代码开发中

---

## 一、项目概览

### 1.1 核心目标（Phase 1 MVP）

实现最小可用链路：用户输入文字描述 → 3 次 LLM 调用（M1 意图分析 → M3 故事线构建 → M4 大纲生成）→ 输出结构化 PPT 大纲并在前端展示。

### 1.2 关键约束

- **不做**：文档解析（M0）、联网搜索（M2）、质量审查（M5）、追问交互
- **API**：阿里云百炼 API + Qwen-Max 模型 + OpenAI SDK
- **技术栈**：Next.js 15.x (App Router) + TypeScript + Tailwind CSS
- **交付形式**：Web 界面 + SSE 流式响应
- **开发周期**：预计 2-3 周

---

## 二、项目里程碑规划

### Phase 1：MVP 最小可用链路（当前 | 2026-03-04 - 2026-03-21）

**目标**：验证核心 3 模块流程，打通前后端链路

**后端开发清单（9 项）**：

| 序号 | 任务名称 | 描述 | 状态 | 优先级 | 预计时长 | 完成条件 |
|------|---------|------|------|--------|---------|---------|
| 1 | 项目初始化 | Next.js 15.x + TS + Tailwind 基础配置 | 待开始 | P0 | 0.5h | 可运行，npm run dev 正常 |
| 2 | 类型定义 | outline.ts, intent.ts, storyline.ts, api.ts | 待开始 | P0 | 1h | 所有核心类型完整定义 |
| 3 | LLM 客户端 | lib/llm-client.ts，调用百炼 API | 待开始 | P0 | 1.5h | callLLM<T>() 可调用，JSON 输出校验 |
| 4 | M1 意图分析 | agent/modules/m1-intent-analyzer.ts | 待开始 | P0 | 2h | 接收文本，输出 IntentAnalysis |
| 5 | M3 故事线构建 | agent/modules/m3-storyline-builder.ts | 待开始 | P0 | 2.5h | 接收文本+意图，输出 Storyline |
| 6 | M4 大纲生成 | agent/modules/m4-outline-generator.ts | 待开始 | P0 | 3h | 接收文本+意图+故事线，输出完整 PPTOutline |
| 7 | Orchestrator | agent/orchestrator.ts，串联 M1→M3→M4 | 待开始 | P0 | 2h | 完整流程可执行，支持回调推送事件 |
| 8 | API 路由 | app/api/generate/route.ts，SSE 接口 | 待开始 | P0 | 1.5h | POST /api/generate，返回 SSE 流 |
| 9 | Prompt 设计 | prompts/m1-intent.ts, m3-storyline.ts, m4-outline.ts | 待开始 | P0 | 4.5h | 3 个 Prompt 完整，JSON 输出稳定 |

**前端开发清单（5 项）**：

| 序号 | 任务名称 | 描述 | 状态 | 优先级 | 预计时长 | 完成条件 |
|------|---------|------|------|--------|---------|---------|
| 1 | InputPanel 组件 | components/InputPanel.tsx，输入面板 | 待开始 | P0 | 1h | 文本输入、参数选择、提交按钮 |
| 2 | ProgressIndicator 组件 | components/ProgressIndicator.tsx，进度指示 | 待开始 | P1 | 0.5h | 显示当前步骤和进度文案 |
| 3 | OutlineViewer 组件 | components/OutlineViewer.tsx，大纲展示 | 待开始 | P1 | 2h | 标签页切换、逐步加载结果 |
| 4 | PageCard 组件 | components/PageCard.tsx，单页卡片 | 待开始 | P1 | 1h | 展示页码、标题、内容要点 |
| 5 | 主页面集成 | app/page.tsx，SSE 连接处理 | 待开始 | P0 | 1.5h | 完整流程可用，生成结果可展示 |

**总计**：14 个开发任务，预计 24 小时工作量（含 Prompt 调试、测试等）

**验收标准**：
- 用户输入"AI 在教育领域的应用"，系统能生成 10-15 页完整大纲
- 大纲包含意图分析、故事线、逐页详细内容
- 前端流式展示生成进度，最终展示完整大纲

---

### Phase 2：文档解析增强（依赖 Phase 1 | 预计 2026-03-24 - 2026-04-11）

**目标**：支持上传文档（PDF / Word / Markdown / TXT），自动解析并生成 PPT 大纲

**核心新增**：
- **M0 文档解析模块**：支持 PDF（pdf-parse）、Word（mammoth）、Markdown、TXT 格式
- **场景识别引擎**：自动判断文档是否为结构化（A）/ 主题型（B）/ 散乱内容（C）
- **M1 升级**：支持接收文档元数据，优化意图分析
- **M4 升级与路由**：根据场景类型选择 M4A（结构还原）或 M4B（主题扩写）
- **后端 API 升级**：新增 `/api/parse`，升级 `/api/generate` 支持 multipart/form-data
- **前端文档上传 UI**：拖拽/点击上传、文件预览、场景显示、流程集成

**子任务分解**（11 个任务）：
1. T1 依赖库安装（pdf-parse, mammoth）- 0.5h
2. T2 类型定义（DocumentParseResult 等）- 2h
3. T3 文件解析实现（4 种格式）- 3.5h
4. T4 M1 升级（支持文档元数据）- 1.5h
5. T5 M4 升级与路由（场景 A/B）- 2.5h
6. T6 API 升级（/api/parse + /api/generate）- 2h
7. T7 前端 UI 组件（DocumentUpload + FilePreview）- 3h
8. T8 Prompt 调试与优化（M0/M1/M4）- 3h
9. T9 集成测试（文件解析、场景识别、端到端）- 1.5h
10. T10 UI 流程集成与优化 - 2h
11. T11 多文件合并（可选，延后）- 1.5h

**总工时**：~24 小时（3 周，每周 8h）

**关键决策**：
- 库选型：pdf-parse（轻量）> pdfjs-dist（功能强）；mammoth（稳定）
- 场景识别：规则引擎优先（无 LLM 调用），Phase 3 如误判率高再加 LLM 微调
- API 设计：/api/parse（纯解析） + 升级 /api/generate（支持 multipart）
- 前端 UX：显示识别结果，用户可手动调整场景类型后再生成

**验收标准**（Phase 2 MVP）：
- ✅ 支持 PDF / Word / Markdown / TXT 上传
- ✅ 场景识别准确率 ≥ 80%
- ✅ 文档生成的大纲逻辑与原文档一致
- ✅ 前端完整流程可用（拖拽 → 解析 → 生成 → 展示）
- ✅ 代码覆盖率 ≥ 75%（关键路径）

**详细计划**：见 `docs/phase2-plan.md` 和 `docs/phase2-exec-summary.md`

---

### Phase 3：联网搜索增强（依赖 Phase 1 | 预计 2026-04-10 - 2026-04-24）

**目标**：在大纲生成时自动搜索补充最新信息

**核心新增**：
- M2 联网搜索模块（Google Search / Tavily API）
- 搜索结果融入大纲内容

**关键决策**：搜索 API 选型（Google 搜索 vs Tavily vs 其他）

---

### Phase 4：体验优化与质量审查（依赖 Phase 1-3 | 预计 2026-04-28 - 2026-05-19）

**目标**：优化 UI/UX，引入质量评分和迭代

**核心新增**：
- M5 质量审查模块（对生成结果打分并提出改进）
- 多轮交互和反馈机制
- 数据持久化（用户历史、版本管理）
- UI 美化和优化

---

## 三、任务依赖关系图

```
后端-项目初始化
    ↓
├─→ 后端-类型定义
│       ↓
│   ├─→ 后端-LLM客户端
│   │       ↓
│   │   ├─→ 后端-M1意图分析 ──┐
│   │   │                      ├─→ 后端-Orchestrator ──→ 后端-API路由
│   │   ├─→ 后端-M3故事线构建 ┤                            ↓
│   │   └─→ 后端-M4大纲生成 ──┘                      前端-主页面集成
│   │
│   └─→ 前端-InputPanel
│   └─→ 前端-OutlineViewer
│   └─→ 前端-PageCard
│
└─→ Prompt 设计（M1 / M3 / M4）
        ↓
    前端-ProgressIndicator
```

---

## 四、当前进度跟踪

### 已完成（2 项）

✅ **产品方案设计** (docs/agent-design.md)
- 完成时间：2026-03-04 之前
- 内容：3 个核心模块（M1、M3、M4）的设计，场景划分，交互流程

✅ **技术架构文档** (docs/architecture.md)
- 完成时间：2026-03-04
- 内容：项目结构、API 设计、数据流、核心模块详细设计
- 版本：v1.0

### 进行中（0 项，待启动）

🔄 **Phase 1 MVP 代码开发**
- 负责人：senior-dev-executor
- 启动时间：待确认
- 预计完成时间：2026-03-21
- 当前状态：准备中，等待启动信号

### 下一步行动

1. **本周任务规划**：确定每日 commit checkpoint，建议每天完成 2-3 项后端任务
2. **Prompt 调试**：M1/M3/M4 Prompt 需要反复测试和迭代，建议提前启动
3. **前端优先级**：主页面集成 + InputPanel 优先，其他组件可后续优化
4. **测试策略**：每完成一个模块立即手动测试，确保输出格式符合类型定义

---

## 五、关键风险和应对

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| **PDF/Word 解析失效**（复杂格式、扫描件） | 高 | 用户上传无用 | W1 末用真实文件测试；推荐纯文本 PDF；降级提示用户转 TXT |
| **场景识别误判**（A/B/C 错误） | 中 | 大纲风格不符 | 前端显示识别结果，用户可手动修改；迭代 Prompt |
| **文件过大超时**（>10MB） | 中 | 用户体验差 | 限制文件大小；显示解度进度；Phase 3 分块上传 |
| 百炼 API 限频 | 中 | 开发延迟 | 使用静态 Mock 数据进行前端开发，后期对接真实 API |
| Prompt 输出不稳定 | 中 | 解析失败 | 使用 Zod 校验 + 自动重试；记录失败 case，持续优化 |
| SSE 连接断开 | 低 | 用户体验差 | 前端实现自动重连，后端设置心跳检测 |
| 模块间数据格式不匹配 | 中 | 需要重构 | 严格遵循 types/ 的类型定义，单元测试覆盖序列化 |

---

## 六、团队协作指南

### 代码审查 Checklist

- [ ] 符合 TypeScript 严格模式
- [ ] 输出 JSON 格式与 types/ 定义一致
- [ ] 新函数有 JSDoc 注释
- [ ] 错误处理完整（try-catch + 错误日志）
- [ ] 测试覆盖关键路径

### 提交规范

```
git commit -m "feat(后端|前端): 任务名称 - 简短描述"

例如：
- git commit -m "feat(后端): LLM客户端 - 实现 callLLM 方法和错误重试"
- git commit -m "feat(前端): InputPanel - 支持文本输入和参数选择"
- git commit -m "feat(prompt): M1意图分析 - 定义 JSON 输出格式"
```

### 每日同步

建议每天 14:00 进行 15 分钟进度同步：
- 昨日完成的任务
- 今日计划完成的任务
- 遇到的阻碍和需要的帮助

---

## 七、成功指标

**Phase 1 MVP 完成的定义**：

1. ✅ 后端 9 个任务全部完成，通过代码审查
2. ✅ 前端 5 个任务全部完成，主要流程可用
3. ✅ 端到端完整流程可用：输入 → 意图分析 → 故事线 → 大纲生成 → 前端展示
4. ✅ 至少 5 个测试用例通过，生成大纲质量符合预期
5. ✅ 文档齐全：API 文档、部署文档、故障排查指南

**质量标准**：
- 代码覆盖率 ≥ 70%（关键路径）
- 生成延迟 ≤ 30 秒
- 错误率 < 5%
- 大纲字数在 500-2000 字之间

---

## 八、参考文档

- 产品设计：`docs/agent-design.md`
- 技术架构：`docs/architecture.md`
- 项目路由：`PROJECT_ROADMAP.md` (本文档)

---

**最后更新**：2026-03-05
**Phase 2 计划**：已完成详细拆解，见 `docs/phase2-plan.md` 和 `docs/phase2-exec-summary.md`
**下次同步计划**：确认资源并启动 W1 任务（T1-T3）
