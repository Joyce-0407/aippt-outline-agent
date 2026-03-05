# Phase 2 计划导航

**快速查询：根据你的角色找到对应的文档**

---

## 👨‍💼 项目经理 / 负责人

**快速了解 Phase 2 全景**
1. 先读：`phase2-exec-summary.md`（5 分钟）
   - 核心改变、关键里程碑、风险 TOP 3
2. 再读：`phase2-plan.md` 第二节「需求分析与场景划分」（5 分钟）
   - 理解场景 A/B/C 的区别
3. 追踪进度：`phase2-task-tracking.md` 的「周进度」部分

**关键指标**：
- 总工时：24.5 小时（3 周，每周 8h）
- 关键路径：T1 → T2 → T3 → T4/T5 → T8 → T9 → T10
- 风险：PDF 解析失效、场景识别误判、文件超时

**决策点**：
- 库选型已定（pdf-parse + mammoth）
- 场景识别用规则引擎（不调用 LLM）
- 多文件合并可选，延后 Phase 2 中期

---

## 👨‍💻 开发者（后端）

**深入理解技术细节**
1. 必读：`phase2-plan.md` 第三节「任务详细拆解」
   - 逐个了解 T1-T11 的具体工作
2. 参考：`phase2-task-tracking.md` 中对应的任务卡片
   - 完成标准、子任务、测试数据

**快速启动（W1）**：
```
T1: npm install pdf-parse mammoth
T2: 创建 src/types/document.ts，定义所有类型
T3: 实现 src/agent/modules/m0-document-parser.ts
    - 4 种文件格式解析
    - 场景识别逻辑
    - 充分测试
```

**关键代码路径**：
- 新增：`src/types/document.ts`
- 新增：`src/agent/modules/m0-document-parser.ts`
- 升级：`src/agent/orchestrator.ts` （集成 M0）
- 升级：`src/agent/prompts/m1-intent.ts` （支持文档元数据）
- 升级：`src/agent/modules/m4-outline-generator.ts` （路由逻辑）

**API 端点**：
- 新增：`POST /api/parse` → 文件解析
- 升级：`POST /api/generate` → 支持 multipart/form-data

**测试覆盖**：
- M0 解析模块：4 种格式，准确率 ≥ 95%
- 场景识别：准确率 ≥ 80%
- API 端点：集成测试完整覆盖
- E2E：至少 3 个完整流程

---

## 🎨 开发者（前端）

**UI 组件与交互设计**
1. 必读：`phase2-plan.md` 第三节「任务 T7」（前端 UI 组件）
2. 参考：`phase2-exec-summary.md` 的「关键里程碑」

**快速启动（W2）**：
```
T7: 创建前端组件
    - DocumentUpload 组件（拖拽 + 选择）
    - FilePreview 组件（预览 + 删除）
    - 升级 InputPanel（集成上传功能）

T10: 流程集成
     - 文件上传 → 解析 → 生成 完整链接
     - 错误处理和用户引导
     - 移动端适配
```

**关键组件**：
- 新增：`src/components/DocumentUpload.tsx`
- 新增：`src/components/FilePreview.tsx`
- 升级：`src/components/InputPanel.tsx`

**交互流程**：
```
用户选择文件
  ↓
前端展示文件列表和上传进度
  ↓
用户点击「解析」
  ↓
调用 /api/parse，显示场景类型
  ↓
用户点击「生成大纲」
  ↓
调用 /api/generate（支持 multipart）
  ↓
SSE 流式展示生成过程
  ↓
展示最终大纲
```

**样式要点**：
- 拖拽区域：虚线边框，居中显示图标
- 文件队列：Card 列表，显示文件名、大小、状态
- 错误提示：红色文案，清晰说明错误原因
- 响应式：手机宽度 100%，触击区域 ≥ 44px

**手机测试**：
- Safari iOS
- Chrome Android
- 网络弱连接模拟

---

## 🔬 测试工程师

**测试计划与验收**
1. 必读：`phase2-task-tracking.md` 的「T9 集成测试」部分
2. 参考：`phase2-plan.md` 第五节「潜在风险与应对」

**测试覆盖范围**：

| 层级 | 范围 | 预期结果 |
|------|------|---------|
| **单元** | M0 解析模块 | 4 种格式，准确率 ≥ 95% |
| **集成** | /api/parse 端点 | 接收文件，返回 DocumentParseResult |
| **集成** | /api/generate 端点 | 支持 multipart 和 JSON 请求 |
| **E2E** | 文件上传 → 生成 | 3 个完整流程成功 |
| **边界** | 超大文件、损坏文件 | 返回合理错误提示 |

**测试数据**：
```
test-data/
├── scenario-a/           # 结构化文档
│   ├── 教学课件.pdf
│   ├── 产品白皮书.docx
│   └── 项目计划.txt
├── scenario-b/           # 主题型文档
│   ├── 技术博客.md
│   ├── 案例分析.pdf
│   └── 自我介绍.txt
└── edge-cases/           # 边界情况
    ├── empty.txt
    ├── corrupted.pdf
    └── large-file.pdf (>10MB)
```

**测试脚本**（使用 Postman / curl）：
```bash
# 测试 /api/parse
curl -F "file=@test-data/scenario-a/教学课件.pdf" \
     http://localhost:3000/api/parse

# 测试 /api/generate (multipart)
curl -F "file=@test-data/scenario-a/教学课件.pdf" \
     -F "llmConfig={...}" \
     http://localhost:3000/api/generate

# 测试 /api/generate (JSON，Phase 1 兼容)
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"userInput": "...", "llmConfig": {...}}' \
     http://localhost:3000/api/generate
```

**验收标准**（Phase 2 MVP）：
- [ ] 4 种文件格式都能正确解析
- [ ] 场景识别准确率 ≥ 80%
- [ ] 生成大纲与原文档逻辑一致
- [ ] 所有错误都有清晰提示
- [ ] 端到端流程无卡顿、无崩溃

---

## 📚 技术方案决策

**为什么选择这些库？**

| 库 | 用途 | 为什么 | 备选 |
|----|------|--------|------|
| **pdf-parse** | PDF 解析 | 轻量、快速；节省成本 | pdfjs-dist（如失效） |
| **mammoth** | Word 解析 | 成熟稳定，支持 .docx | docx（暂不考虑） |
| 原生 fs | TXT / MD | 无依赖，直接读取 | 无需备选 |

**为什么场景识别不用 LLM？**
- 规则引擎足够准确（≥80%）
- 降低 LLM 调用成本
- Phase 3 如误判率高，再加 LLM 微调

**为什么分离 /api/parse 和 /api/generate？**
- 前端需要先查看解析结果，确认场景类型
- 降低 /api/generate 的复杂度
- 便于调试和缓存

---

## 📞 常见问题速查

**Q: 如何快速了解整个 Phase 2？**
A: 依次阅读：
1. phase2-exec-summary.md（5 分钟）
2. phase2-plan.md 第 1-2 节（10 分钟）
3. phase2-task-tracking.md 中你的任务卡片（10 分钟）

**Q: 时间不足的情况下应该怎么砍任务？**
A: 优先级顺序：
1. 不能砍：T1-T3 (基础)、T4-T6 (核心)
2. 可压缩：T8 (Prompt 优化)
3. 可延后：T11 (多文件合并)

**Q: 如何处理库兼容性问题？**
A: 不要反复尝试，立即切换备选方案或降级需求。例如 pdf-parse 失效 → 改 pdfjs-dist 或简化为 TXT 支持。

**Q: Phase 2 中期检查点是什么？**
A: W2 末，应完成：
- [ ] T1-T3 全部完成，代码审查通过
- [ ] /api/parse 和 /api/generate 都支持文件上传
- [ ] 前端 DocumentUpload 组件可用
- [ ] 手动测试：单个文件上传到 API 调用流程可用

---

## 📋 文档导航图

```
PHASE2_README.md (你在这里)
├─ phase2-exec-summary.md           ← 快速了解全景（5 分钟）
│  ├─ 核心改变
│  ├─ 关键里程碑
│  ├─ 风险 TOP 3
│  └─ 周 Checklist
├─ phase2-plan.md                   ← 详细计划和设计（30 分钟）
│  ├─ 场景划分（A/B/C）
│  ├─ 11 个任务详细拆解
│  ├─ 依赖关系
│  ├─ 风险与应对
│  └─ 技术决策记录
└─ phase2-task-tracking.md          ← 任务执行跟踪（任务卡片）
   ├─ T1-T11 详细任务卡
   ├─ 完成标准和测试数据
   ├─ 周进度跟踪表
   └─ FAQ
```

---

## 🎯 立即行动

**立刻做这三件事**：

1. **分享计划**（今天）
   - 发送 `phase2-exec-summary.md` 给团队
   - 核对资源和时间安排

2. **准备测试数据**（本周）
   - 在 `test-data/` 下准备 3-5 个示例文档
   - PDF (A), Markdown (B), Word (B/C)

3. **启动 W1 任务**（本周末）
   - 开始 T1 (npm install)
   - 完成 T2 (类型定义)
   - 启动 T3 (文件解析)

**目标**：本周末完成 T1-T3，形成可工作的 M0 模块。

---

**最后更新**：2026-03-05
**主计划文件**：`phase2-plan.md`
**任务跟踪**：`phase2-task-tracking.md`

