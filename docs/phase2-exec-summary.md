# Phase 2 执行摘要与快速启动指南

**文档日期**：2026-03-05
**目标完成**：2026-04-11
**工作量**：~24 小时（3 周，每周 8h）

---

## 核心改变（vs Phase 1）

| 维度 | Phase 1 | Phase 2 |
|------|--------|--------|
| **输入** | 文字输入 | 文字 + 文档上传（PDF/Word/MD/TXT） |
| **M0** | 无 | ✨ 新增：文档解析 + 场景识别（A/B/C） |
| **路由** | 固定场景 B | 根据 M0 识别场景 A/B/C，选择不同 M4 |
| **M4** | M4B 主题扩写 | M4A 结构还原 + M4B 主题扩写 |
| **前端** | 文字输入 | ✨ 新增：拖拽上传、文件预览、场景展示 |
| **API** | `/api/generate` | ✨ 新增 `/api/parse`；升级 `/api/generate` 支持 multipart |

---

## 关键里程碑（4 周期）

### W1 (3/24-3/28)：基础设施
- ✅ 库安装（pdf-parse, mammoth）
- ✅ 类型定义（DocumentParseResult 等）
- ✅ M0 文件解析实现（4 种格式）
- **交付**：能解析文件并提取文本

### W2 (3/31-4/4)：模块升级
- ✅ M1 升级（支持文档元数据）
- ✅ M4 升级和路由（场景 A/B）
- ✅ `/api/parse` 和 `/api/generate` 升级
- **交付**：后端 API 可用，支持文件上传

### W2-W3 (4/1-4/4)：前端实现
- ✅ DocumentUpload 组件（拖拽 + 选择）
- ✅ FilePreview 组件（文件列表）
- ✅ Prompt 调试（M0/M1/M4 优化）
- **交付**：前端 UI 完整

### W3 (4/7-4/11)：测试与优化
- ✅ 集成测试（文件 → 解析 → 生成）
- ✅ UI 集成（流程串联）
- ✅ 兼容性测试（错误处理）
- **交付**：完整可用的 Phase 2 MVP

---

## 11 个任务的优先级与依赖

```
🟢 立即启动（W1）：
  T1 库安装 (0.5h)
  T2 类型定义 (2h)
  T3 文件解析 (3.5h)

🟡 W1 末启动（依赖 T2/T3）：
  T4 M1 升级 (1.5h)
  T5 M4 升级 (2.5h)
  T6 API 升级 (2h)
  T7 前端 UI (3h)

🔵 W2 末启动（依赖 T4-T7）：
  T8 Prompt 调试 (3h)
  T9 集成测试 (1.5h)
  T10 UI 集成 (2h)

⚪ 可选/延后（W3 后）：
  T11 多文件合并 (1.5h)
```

---

## 关键决策速览

### 文档解析库选择
- **PDF**：pdf-parse（轻量，快速验证）→ 备选 pdfjs-dist（功能强）
- **Word**：mammoth（成熟稳定）
- **Markdown/TXT**：原生 fs.readFileSync（无依赖）

### 场景识别方式
- **规则引擎**（推荐，无 LLM 调用）：基于标题比例、分页符、列表项数
- **备选**：加入 LLM 微调（Phase 3 如误判率高）

### API 路由设计
- **新增**：`/api/parse` → 纯文件解析，返回场景类型
- **升级**：`/api/generate` → 支持 multipart/form-data，支持文本/文件/混合

### 前端 UI 架构
- **Tab 模式**或**并行显示**（推荐）：用户可同时提供文本+文档
- **必须**：显示解析结果（场景类型、内容摘要），用户可调整再生成

---

## 风险 TOP 3 与应对

| # | 风险 | 概率 | 应对 |
|---|------|------|------|
| 1 | **PDF/Word 解析失效**（复杂格式） | 高 | 提前用真实文件测试；推荐文本 PDF；降级到 TXT |
| 2 | **场景识别误判**（A/B/C 错误） | 中 | 前端显示识别结果，用户可手动修改；迭代 Prompt |
| 3 | **文件过大超时**（>10MB） | 中 | 限制文件大小；显示上传进度；Phase 3 分块上传 |

**关键行动**：W1 末完成 T3 后立即用真实文件测试，发现问题早调整。

---

## 每周 Checklist

### W1 (3/24-3/28)
- [ ] T1 完成：npm install pdf-parse mammoth 成功
- [ ] T2 完成：types/document.ts 定义清晰
- [ ] T3 完成：4 种文件格式都能解析，场景识别逻辑已实现
- [ ] 代码审查：M0 模块通过 review

### W2 (3/31-4/4)
- [ ] T4 完成：M1 支持文档元数据，Prompt 已升级
- [ ] T5 完成：M4 支持路由，A/B 场景生成逻辑清晰
- [ ] T6 完成：/api/parse 和 /api/generate 都支持文件上传
- [ ] T7 完成：DocumentUpload 组件可用，UI 美观
- [ ] 手动测试：单个文件从上传到 API 调用全流程可用

### W2-W3 (4/1-4/4)
- [ ] T8 完成：Prompt 已迭代，测试用例通过
- [ ] T9 完成：集成测试覆盖 4 种文件格式，准确率 ≥80%
- [ ] T10 完成：前端流程串联，E2E 可用

### W3 (4/7-4/11)
- [ ] T11 (可选)：如启动，多文件合并可用
- [ ] 文档完善：README / API 文档 / 部署指南更新
- [ ] 最终测试：5 个端到端用例通过
- [ ] 提交：所有代码 push，生成 release tag

---

## 文件清单

**新增文件** (Phase 2 必须交付)
```
src/types/document.ts                       # 文档类型定义
src/agent/modules/m0-document-parser.ts    # M0 解析模块
src/agent/prompts/m0-*.ts                  # M0 Prompt 集合
src/app/api/parse/route.ts                 # 解析 API
src/components/DocumentUpload.tsx           # 上传组件
src/components/FilePreview.tsx              # 预览组件
docs/file-formats-support.md               # 格式支持说明
docs/phase2-api.md                         # API 文档
docs/scenario-routing.md                   # 场景识别算法
```

**升级文件** (基于 Phase 1 修改)
```
src/agent/modules/m4-outline-generator.ts  # 加路由逻辑
src/agent/prompts/m1-intent.ts             # 升级 Prompt
src/agent/orchestrator.ts                  # 集成 M0
src/app/api/generate/route.ts              # 支持 multipart
src/components/InputPanel.tsx               # 集成上传组件
package.json                                # 新增 pdf-parse, mammoth
```

---

## 成功标志

✅ **技术交付**
- [ ] 能上传并解析 PDF / Word / Markdown / TXT
- [ ] 场景识别准确率 ≥ 80%
- [ ] 生成大纲质量与原文档逻辑一致

✅ **用户体验**
- [ ] 拖拽上传可用，反馈清晰
- [ ] 从上传到生成结果全流程 < 60 秒
- [ ] 错误提示有用，用户知道如何解决

✅ **代码质量**
- [ ] 测试覆盖率 ≥ 75%（关键路径）
- [ ] 无严重错误，可部署到生产
- [ ] 文档完整，下一个开发者能快速上手

---

## 快速启动（今天）

1. **分享这个计划**：给技术团队，收集反馈
2. **确认资源**：确认 W1 能分配的时间和人力
3. **准备测试文件**：在 test-data/ 下准备 3-5 个示例文档
4. **建立进度跟踪**：周一创建项目管理板，跟踪 11 个任务
5. **启动 W1**：立即开始 T1 (库安装) 和 T2 (类型定义)

**目标**：本周末完成 T1-T3，形成可工作的 M0 模块。

---

**反馈与调整**

本计划是动态的。如遇以下情况，立即调整：
- 某个库因兼容性问题无法使用 → 换备选方案
- 文件解析失败率高 → 简化支持格式，聚焦 PDF + Markdown
- 工时严重超期（>20% 偏差） → 砍 T11 / 内容优化，聚焦核心 MVP

**联系**：技术负责人定期 review，每周同步一次。

