# Phase 4：LLM 生成 HTML 幻灯片 -- 完整产品方案

> 版本：v1.0 | 日期：2026-03-07
> 前置验证：已通过 `/api/test-slide` 验证 LLM 可生成品质合格的 16:9 HTML PPT 页面

---

## 一、方案背景与决策

### 1.1 为什么选择 LLM 生成 HTML 而非模板渲染

上一版方案 (`docs/phase4-ppt-preview.md`) 推荐了前端模板渲染（方案 A）。但经过实际验证，LLM 直接生成 HTML 的效果超出预期：

- **视觉品质高**：LLM 能根据内容语义做出创造性的视觉编排，每页独一无二
- **布局灵活性强**：不受预定义模板数量限制，layout 描述越丰富效果越好
- **开发量反而更少**：不需要开发 10+ 种 React 布局模板组件
- **维护成本低**：优化效果只需调整 prompt，不需要修改组件代码

代价是增加了 LLM 调用时间和 token 消耗，但通过并发策略可以将额外等待控制在 15-25 秒内，对用户来说是可接受的。

### 1.2 核心设计原则

1. **生成一页展示一页**：不让用户干等所有页面完成，每完成一页立即可见
2. **质量有底线**：爆版（内容溢出）的页面不展示给用户，自动重试修复
3. **优雅降级**：重试多次仍失败的页面，提供降级展示而非空白
4. **成本可控**：通过合理的并发数和 prompt 优化，控制 token 消耗

---

## 二、整体流程设计

### 2.1 触发方式：大纲完成后自动触发

**推荐方案：自动触发 + 同一 SSE 流**

大纲生成（M4）完成后，不关闭 SSE 连接，直接进入 HTML 生成阶段（M5）。理由：

- 用户从输入到看到 PPT 是一个连续的心智流程，中间断开会产生割裂感
- 自动触发减少一次用户操作，体验更流畅
- 同一 SSE 流避免前端重新建连的复杂度

**时序流程：**

```
用户点击「生成」
    |
    v
[M1 意图分析] ----status----> 前端进度条
    |
    v
[M3 故事线]   ----status----> 前端进度条
    |
    v
[M2 检索]     ----status----> 前端进度条 (可选)
    |
    v
[M4 大纲生成] --page(1..N)--> 前端逐页展示大纲卡片
    |
    v  (M4 完成，outline 事件推送)
    |
[M5 HTML 生成] --status-----> 前端进度更新："正在生成 PPT 预览..."
    |            --slide_html(i)--> 前端逐页展示 HTML 幻灯片
    |            --slide_retry(i)-> 前端显示重试状态 (可选)
    |            --slide_error(i)-> 前端记录失败页
    v
[done]         ----done-----> 前端：全部完成，自动切换到 PPT 预览视图
```

### 2.2 用户体验流程

1. 用户输入主题 -> 点击「生成」
2. 进度条依次推进：意图分析 -> 故事线 -> 大纲生成
3. 大纲生成时逐页展示卡片（现有体验不变）
4. 大纲全部完成后，进度条新增一步：「正在生成 PPT 预览...」
5. 底部出现幻灯片缩略图区域，生成一页就出现一页（带"加载中"占位）
6. 全部生成完毕后，自动切换到 PPT 预览的幻灯片浏览模式
7. 用户可在「大纲视图」和「PPT 预览」之间切换

### 2.3 前端状态流转

```
idle -> generating(M1~M4) -> generating(M5) -> done
                                            -> error (如果全部失败)
```

在 M5 阶段，前端需要跟踪每页 HTML 的独立状态：

```typescript
type SlideHtmlStatus = "pending" | "generating" | "done" | "retrying" | "failed";

interface SlideHtmlState {
  pageIndex: number;
  status: SlideHtmlStatus;
  html?: string;        // 生成成功的 HTML 字符串
  attempt: number;      // 当前尝试次数
  error?: string;       // 失败原因
}
```

---

## 三、并发策略

### 3.1 推荐并发数：3

**分析依据：**

| 并发数 | 总时间 (12页) | 风险 | 适用场景 |
|--------|-------------|------|---------|
| 1 (串行) | ~60-84s | 无 | 不推荐，太慢 |
| 2 | ~30-42s | 低 | 保守方案 |
| **3** | **~20-28s** | **低** | **推荐方案** |
| 4 | ~15-21s | 中 | API 限流风险上升 |
| 6 | ~10-14s | 高 | 大多数 API 会限流 |

**选择 3 的理由：**

1. **DashScope (qwen-max) 默认并发限制通常在 5-10**，3 并发留有余量
2. **网络稳定性**：3 个并发连接的网络负担可控
3. **体验节奏感**：3 并发意味着大约每 5-7 秒产出一批页面，用户能感受到持续的进展
4. **重试空间**：发现爆版时需要重试，3 并发为重试留出了带宽
5. **12 页典型场景**：3 并发 x 4 批 = 12 页，逻辑整洁

### 3.2 并发控制实现

采用**信号量 (Semaphore)** 模式控制并发：

```typescript
// 伪代码
async function generateAllSlideHtml(
  pages: Page[],
  designSystem: GlobalDesignSystem,
  config: LLMClientConfig,
  onSlideReady: (index: number, html: string) => void,
  onSlideRetry: (index: number, attempt: number) => void,
  onSlideError: (index: number, error: string) => void
): Promise<Map<number, string>> {
  const MAX_CONCURRENCY = 3;
  const MAX_RETRIES = 2;       // 最多重试 2 次（总共最多 3 次尝试）
  const semaphore = new Semaphore(MAX_CONCURRENCY);
  const results = new Map<number, string>();

  const tasks = pages.map((page, index) =>
    semaphore.acquire(async () => {
      for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
        try {
          const html = await generateSingleSlideHtml(page, designSystem, config);
          const isOverflow = detectOverflow(html);

          if (!isOverflow || attempt > MAX_RETRIES) {
            if (isOverflow) {
              // 最后一次仍爆版，应用 CSS 强制裁切后交付
              const fixedHtml = applyOverflowFix(html);
              results.set(index, fixedHtml);
              onSlideReady(index, fixedHtml);
            } else {
              results.set(index, html);
              onSlideReady(index, html);
            }
            break;
          }

          // 爆版了，准备重试
          onSlideRetry(index, attempt);
        } catch (error) {
          if (attempt > MAX_RETRIES) {
            onSlideError(index, error.message);
            break;
          }
        }
      }
    })
  );

  await Promise.allSettled(tasks);
  return results;
}
```

### 3.3 失败处理策略

| 失败类型 | 处理方式 |
|---------|---------|
| LLM API 调用失败 (网络/限流) | 等待 2s 后重试，最多 2 次 |
| 返回内容不是合法 HTML | 重试，prompt 不变 |
| 爆版（内容溢出） | 重试，prompt 追加约束（见第四节） |
| 重试全部失败 | 标记该页为 `failed`，前端显示降级卡片 |
| 超过 50% 页面失败 | 推送全局错误事件，建议用户重试 |

---

## 四、爆版检测方案（核心难点）

### 4.1 方案选型

| 方案 | 可行性 | 准确度 | 实现难度 | 推荐度 |
|------|--------|--------|---------|--------|
| A: 后端 Headless Browser | 高 | 高 | 高（需安装 Puppeteer） | 不推荐MVP |
| **B: 前端 JS 检测** | **高** | **高** | **低** | **MVP 推荐** |
| C: Prompt 强约束 + CSS overflow:hidden | 中 | 低 | 极低 | 作为辅助手段 |
| D: LLM 自我检查 (二次调用) | 中 | 中 | 中 | 不推荐 |

**推荐组合：C (Prompt 预防) + B (前端检测) 双保险**

### 4.2 第一层防线：Prompt 预防 (方案 C)

在生成 HTML 的 prompt 中加入严格的约束：

```
## 关键约束（必须严格遵守）

1. 页面总尺寸固定为 1280x720px，html 和 body 设置 width:1280px; height:720px; overflow:hidden; margin:0; padding:0
2. 所有内容必须在 1280x720 区域内完整展示，不允许任何内容超出该区域
3. 内容区域建议使用 padding: 60px 80px，确保内容不贴边
4. 文字行数限制：标题最多 2 行，正文每个要点最多 3 行，超出部分用省略号截断
5. 使用 CSS 的 overflow:hidden 和 text-overflow:ellipsis 防止任何溢出
6. 不要使用会导致内容超出的 CSS 属性：不要用 position:absolute 将元素放到可视区域外
7. 内容块数量较多时（超过 4 个），减小字号或简化排版，确保全部在区域内
8. body 样式必须包含：width:1280px; height:720px; overflow:hidden; position:relative; box-sizing:border-box
```

### 4.3 第二层防线：前端检测 (方案 B)

**检测原理**：在一个不可见的 iframe 中渲染 HTML，检查内容是否溢出 720px 高度。

```typescript
async function detectOverflow(html: string): Promise<boolean> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:1280px;height:720px;border:none;visibility:hidden";
    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) { resolve(false); return; }

        const body = doc.body;
        // 检测 scrollHeight 是否超出 720
        const isOverflow = body.scrollHeight > 725; // 5px 容差
        resolve(isOverflow);
      } catch {
        resolve(false); // 检测失败时假设不爆版
      } finally {
        document.body.removeChild(iframe);
      }
    };

    iframe.srcdoc = html;

    // 超时保护：1 秒内没完成就放弃检测
    setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
        resolve(false);
      }
    }, 1000);
  });
}
```

**关键细节：**
- iframe 设置为 `width:1280px; height:720px`，模拟真实渲染尺寸
- 比较 `body.scrollHeight > 720`（加 5px 容差处理浮点误差）
- 检测在前端完成，零额外服务器成本
- 检测耗时 ~100-300ms，用户无感

### 4.4 检测与重试的工作流

```
生成 HTML
    |
    v
[前端接收 HTML]
    |
    v
[在隐藏 iframe 中检测溢出]  <-- ~100-300ms
    |
    ├── 没有溢出 --> 展示给用户
    |
    └── 检测到溢出
          |
          v
        [已重试 >= 2 次?]
          |
          ├── 是 --> 应用 CSS overflow:hidden 强制裁切，展示降级版本
          |
          └── 否 --> 向后端发起重试请求，prompt 追加约束
```

### 4.5 爆版重试时的 Prompt 调整

重试时在原有 prompt 末尾追加：

```
## 重要修正

上一次生成的 HTML 内容超出了 1280x720 区域。请特别注意：
- 减少内容量，优先保证核心信息，次要信息可省略
- 减小字号：标题不超过 36px，正文不超过 16px
- 增加内容区域的 padding，确保四周留白充足
- 内容块如果超过 3 个，考虑使用更紧凑的布局（如网格）
- 所有容器必须设置 overflow:hidden
- body 必须设置 height:720px; overflow:hidden
```

### 4.6 降级策略

如果 3 次尝试后仍然爆版：

1. **CSS 强制修复**：给最终的 HTML 注入 `<style>html,body{width:1280px!important;height:720px!important;overflow:hidden!important;}</style>`
2. **前端标记**：在缩略图上显示一个小三角警告图标，提示"此页可能有布局问题"
3. **不阻塞整体流程**：一页的失败不影响其他页面

---

## 五、架构设计：前端驱动 vs 后端驱动

### 5.1 推荐方案：后端编排 + 前端检测

**为什么爆版检测放前端而不是后端？**

| 维度 | 后端检测 (Puppeteer) | 前端检测 (iframe) |
|------|---------------------|------------------|
| 部署复杂度 | 需要安装 Chromium | 零额外依赖 |
| 渲染准确度 | 高 | 高（同样是浏览器渲染） |
| 检测延迟 | ~1-3s（启动浏览器实例） | ~100-300ms |
| 服务器资源 | 高（内存密集） | 零 |
| Vercel/Serverless 兼容 | 困难 | 完美 |

**结论**：前端检测在 MVP 阶段是最优选择。浏览器本身就是最好的 HTML 渲染引擎，利用 iframe 检测既准确又轻量。

### 5.2 重试流程的触发方式

**方案：前端检测到爆版后，通过独立 API 请求重试**

由于 SSE 是单向的（服务端 -> 客户端），前端无法在 SSE 流中"回话"告知后端某页爆版了。因此：

1. SSE 流负责首次生成的所有页面推送
2. 前端收到 HTML 后在本地检测爆版
3. 如果爆版，前端发起一个独立的 POST 请求到 `/api/generate-slide` 进行重试
4. 重试请求携带原始页面数据 + 追加的约束 prompt

```
SSE 流（首次生成）:
  后端 M5 并发生成 --> slide_html(0) --> slide_html(2) --> slide_html(1) --> ...

前端检测到 slide(2) 爆版:
  POST /api/generate-slide { page, designSystem, llmConfig, isRetry: true }
  --> 返回 { html, pageIndex }
  --> 前端再次检测
  --> 如果还爆版，再重试或降级
```

这种架构的好处：
- SSE 流逻辑不变，保持简洁
- 重试逻辑完全由前端控制，灵活度高
- 后端 `/api/generate-slide` 是一个简单的无状态 API，可复用 test-slide 的逻辑

---

## 六、SSE 事件设计

### 6.1 新增事件类型

在现有 SSEEvent 联合体中新增以下事件：

```typescript
export type SSEStep = "parse" | "intent" | "storyline" | "research" | "outline" | "slides";
//                                                                                ^^^^^^ 新增

export type SSEEvent =
  | { /* ... 现有事件不变 ... */ }

  // ── M5 HTML 幻灯片生成相关事件 ──

  | {
      /** M5 进入 HTML 生成阶段 */
      type: "slides_start";
      totalPages: number;
    }
  | {
      /** 单页 HTML 生成完成 */
      type: "slide_html";
      pageIndex: number;     // 0-based 索引
      html: string;          // 完整的 HTML 字符串
    }
  | {
      /** 单页生成失败（重试耗尽） */
      type: "slide_error";
      pageIndex: number;
      message: string;
    }
  // done 事件复用现有的 { type: "done" }
  ;
```

**设计说明：**
- `slides_start`：通知前端即将开始 HTML 生成，前端切换到预览等待界面
- `slide_html`：核心事件，逐页推送。`pageIndex` 用 0-based 方便数组操作
- `slide_error`：单页失败通知。前端收到后显示降级卡片
- 重试逻辑由前端独立发起，不通过 SSE 传输

### 6.2 事件时序示例 (12 页 PPT，并发 3)

```
timeline: 0s -------- 5s -------- 10s ------- 15s ------- 20s ------- 25s

SSE 事件流:
  t=0s   status(step:"slides")     "正在生成 PPT 预览..."
  t=0s   slides_start(total:12)

  t=5s   slide_html(0)             // 第 1 批完成（3 页并发）
  t=6s   slide_html(2)
  t=7s   slide_html(1)

  t=12s  slide_html(3)             // 第 2 批
  t=13s  slide_html(5)
  t=14s  slide_html(4)

  t=19s  slide_html(6)             // 第 3 批
  t=20s  slide_html(8)
  t=20s  slide_html(7)

  t=25s  slide_html(9)             // 第 4 批
  t=26s  slide_html(11)
  t=27s  slide_html(10)

  t=27s  done

前端独立重试 (与 SSE 并行):
  t=6s   检测到 slide(2) 爆版 --> POST /api/generate-slide (重试)
  t=12s  收到重试结果 --> 替换 slide(2) 的 HTML
```

---

## 七、后端模块设计

### 7.1 新增 M5 模块

```
src/agent/modules/m5-slide-renderer.ts
```

**核心职责：**
- 接收完整大纲 (`PPTOutline`)，为每页生成 HTML
- 控制并发数 (3)
- 管理 LLM 调用和基础错误重试（API 级别的重试，非爆版重试）
- 通过回调推送每页结果

```typescript
// m5-slide-renderer.ts

export interface SlideRenderCallbacks {
  onSlideReady: (pageIndex: number, html: string) => void;
  onSlideError: (pageIndex: number, error: string) => void;
}

export async function renderSlidesToHtml(
  outline: PPTOutline,
  config: LLMClientConfig,
  callbacks: SlideRenderCallbacks
): Promise<void>;

// 单页生成（也被 /api/generate-slide 复用）
export async function renderSingleSlide(
  page: Page,
  designSystem: GlobalDesignSystem,
  config: LLMClientConfig,
  isRetry?: boolean
): Promise<string>;
```

### 7.2 新增单页生成 API

```
src/app/api/generate-slide/route.ts
```

**用途**：供前端在爆版检测后独立调用重试

```typescript
// POST /api/generate-slide
// Body: { page, designSystem, llmConfig, isRetry?: boolean }
// Response: { html: string }
```

基本上就是现有 `test-slide/route.ts` 的正式化版本，增加 `isRetry` 参数支持追加约束 prompt。

### 7.3 Orchestrator 集成

修改 `src/agent/orchestrator.ts`，在 M4 完成后调用 M5：

```typescript
// orchestrator.ts generateOutline() 末尾

// ── M4 完成 ──
onEvent({ type: "outline", data: outline });

// ── M5 HTML 生成 ──
onEvent({ type: "status", step: "slides", message: "正在生成 PPT 预览..." });
onEvent({ type: "slides_start", totalPages: outline.pages.length });

await renderSlidesToHtml(outline, config, {
  onSlideReady: (pageIndex, html) => {
    onEvent({ type: "slide_html", pageIndex, html });
  },
  onSlideError: (pageIndex, error) => {
    onEvent({ type: "slide_error", pageIndex, message: error });
  },
});

onEvent({ type: "done" });
```

### 7.4 Prompt 设计

核心 prompt 沿用已验证的 `test-slide/route.ts` 中的 prompt，做以下增强：

1. **更严格的尺寸约束**（预防爆版）
2. **增加页码上下文**：告知 LLM 这是第 X 页 / 共 N 页，帮助它理解封面/结尾的特殊处理
3. **增加前后页衔接**：告知前一页和后一页的标题，帮助视觉风格连贯
4. **重试模式**：`isRetry=true` 时追加缩减内容的指令

---

## 八、前端设计

### 8.1 预览界面架构

```
页面结构（大纲完成后）:

+------------------------------------------------------------------+
|  AIPPT 生成器  [Beta]                          [模型设置]          |
+------------------------------------------------------------------+
|  [输入面板]                                                        |
|  [进度指示器] ---- 新增「PPT 预览」步骤                              |
|                                                                    |
|  [大纲视图]  [PPT 预览]   <-- Tab 切换（大纲完成后出现）              |
|                                                                    |
|  ┌─────────────────────────────────────────────────────────┐       |
|  │                                                         │       |
|  │          当前视图内容                                     │       |
|  │                                                         │       |
|  └─────────────────────────────────────────────────────────┘       |
+------------------------------------------------------------------+
```

### 8.2 HTML 页面渲染方式：iframe + srcDoc

```typescript
<iframe
  srcDoc={slideHtml}
  style={{
    width: 1280,
    height: 720,
    transform: `scale(${scaleFactor})`,
    transformOrigin: "top left",
    border: "none",
  }}
  sandbox="allow-same-origin"  // 不允许脚本执行，安全
  title={`Slide ${pageIndex + 1}`}
/>
```

**为什么用 iframe 而不是 dangerouslySetInnerHTML？**
- **安全隔离**：iframe 天然沙箱化，LLM 生成的 HTML 不会影响主页面
- **样式隔离**：LLM 生成的 CSS 不会与主应用的 Tailwind 冲突
- **尺寸隔离**：可以在 1280x720 尺寸下渲染，再缩放展示
- **已验证**：test-slide 页面已经用这种方式跑通

### 8.3 幻灯片浏览模式

```
+------------------------------------------------------------------+
|  [大纲视图]  [PPT 预览 (12/12)]                                    |
+------------------------------------------------------------------+
|                                                                    |
|                                                                    |
|     +--------------------------------------------------+          |
|     |                                                  |          |
|     |            16:9 PPT 页面 (iframe)                 |          |
|     |            (居中展示，自适应宽度缩放)               |          |
|     |                                                  |          |
|     +--------------------------------------------------+          |
|                                                                    |
|               [<]  第 3 页 / 共 12 页  [>]                         |
|                                                                    |
|  ┌──┐ ┌──┐ ┌━━┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ...               |
|  │1 │ │2 │ ┃3 ┃ │4 │ │5 │ │ ░│ │ ░│ │ ░│ │ ░│  底部缩略图导航     |
|  └──┘ └──┘ └━━┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘                    |
|  已完成    当前   已完成          生成中/等待中(骨架屏)               |
+------------------------------------------------------------------+
```

**交互细节：**

| 交互 | 行为 |
|------|------|
| 左右箭头键 | 翻页 |
| 点击缩略图 | 跳转到对应页 |
| 缩略图未生成 | 显示为骨架屏/加载动画 |
| 缩略图生成失败 | 显示灰色卡片 + 错误提示 |
| 页面生成中 | 主区域显示 loading 动画 |

### 8.4 缩略图导航条

缩略图是缩小版的 iframe，缩放比例约 0.12（1280 * 0.12 = ~154px 宽）。

**性能优化**：
- 缩略图使用 `pointer-events: none` 禁止交互，减少事件处理
- 仅在视口可见时渲染 iframe（Intersection Observer）
- 对于 20+ 页的 PPT，考虑虚拟化滚动

### 8.5 与大纲视图的关系

**Tab 切换，两个视图并存：**

```typescript
type ViewMode = "outline" | "preview";
const [viewMode, setViewMode] = useState<ViewMode>("outline");
```

- 大纲生成过程中：只显示大纲视图（Tab 不可点击 PPT 预览）
- 大纲生成完成、M5 开始后：两个 Tab 都可切换
- M5 全部完成后：自动切换到 PPT 预览视图
- 用户随时可以切回大纲视图查看结构化数据

### 8.6 前端爆版检测与重试流程

```typescript
// 伪代码：前端收到 slide_html 事件后的处理

async function handleSlideHtml(pageIndex: number, html: string) {
  // 1. 先展示给用户（即使可能爆版，先让用户看到内容）
  updateSlideState(pageIndex, { status: "done", html });

  // 2. 后台静默检测爆版
  const isOverflow = await detectOverflowInHiddenIframe(html);

  if (isOverflow && retryCount[pageIndex] < MAX_RETRIES) {
    // 3. 标记为重试中
    updateSlideState(pageIndex, { status: "retrying" });
    retryCount[pageIndex]++;

    // 4. 调用独立 API 重试
    const response = await fetch("/api/generate-slide", {
      method: "POST",
      body: JSON.stringify({
        page: outline.pages[pageIndex],
        designSystem: outline.meta.designSystem,
        llmConfig,
        isRetry: true,
      }),
    });
    const { html: newHtml } = await response.json();

    // 5. 再次检测
    const stillOverflow = await detectOverflowInHiddenIframe(newHtml);
    if (!stillOverflow) {
      updateSlideState(pageIndex, { status: "done", html: newHtml });
    } else {
      // 降级：强制注入 overflow:hidden
      const fixedHtml = injectOverflowFix(newHtml);
      updateSlideState(pageIndex, { status: "done", html: fixedHtml });
    }
  } else if (isOverflow) {
    // 重试次数用尽，降级处理
    const fixedHtml = injectOverflowFix(html);
    updateSlideState(pageIndex, { status: "done", html: fixedHtml });
  }
}

function injectOverflowFix(html: string): string {
  // 在 </head> 前注入强制样式
  const fixCSS = `<style>html,body{width:1280px!important;height:720px!important;overflow:hidden!important;}</style>`;
  return html.replace("</head>", fixCSS + "</head>");
}
```

**体验优化**：先展示首次结果，重试在后台静默进行。用户看到的是"页面在变好"，而不是"页面在等待"。

---

## 九、新增文件结构

```
src/
├── agent/
│   └── modules/
│       └── m5-slide-renderer.ts          # 新增：M5 HTML 生成模块
├── agent/
│   └── prompts/
│       └── m5-slide.ts                   # 新增：M5 prompt 模板
├── app/
│   └── api/
│       └── generate-slide/
│           └── route.ts                  # 新增：单页重试 API
├── components/
│   ├── SlidePreview.tsx                  # 新增：幻灯片预览主组件
│   ├── SlideThumbnailStrip.tsx           # 新增：底部缩略图导航条
│   ├── SlideIframe.tsx                   # 新增：iframe 渲染组件
│   └── OutlineDisplay.tsx                # 修改：适配 Tab 切换
├── hooks/
│   └── useOverflowDetection.ts           # 新增：爆版检测 hook
├── lib/
│   └── overflow-detector.ts              # 新增：iframe 爆版检测逻辑
└── types/
    └── api.ts                            # 修改：新增 SSE 事件类型
```

---

## 十、MVP 范围

### 10.1 MVP 做什么 (P0)

| 功能 | 描述 |
|------|------|
| M5 模块 | 大纲完成后自动调用 LLM 为每页生成 HTML |
| 并发生成 | 3 路并发，信号量控制 |
| SSE 推送 | slides_start / slide_html / slide_error 三种新事件 |
| iframe 预览 | 16:9 缩放展示，安全沙箱 |
| 幻灯片浏览 | 单页查看 + 左右翻页 + 键盘支持 |
| 底部缩略图导航 | 点击跳转，当前页高亮，未完成骨架屏 |
| 视图 Tab 切换 | 大纲视图 / PPT 预览切换 |
| Prompt 防爆版 | 严格的尺寸约束写入 prompt |
| 前端爆版检测 | 隐藏 iframe 检测 scrollHeight |
| 自动重试 | 爆版后最多 2 次重试 |
| 降级策略 | 重试失败后 CSS 强制裁切 |
| 单页重试 API | `/api/generate-slide` 供前端爆版重试用 |

### 10.2 MVP 不做什么

| 功能 | 推迟原因 |
|------|---------|
| 缩略图总览网格模式 | 需要额外的组件和性能优化，Phase 5 |
| 全屏演示模式 | 锦上添花，MVP 不阻塞 |
| 页面编辑 | 复杂度极高，Phase 5+ |
| 导出为图片/PDF | html2canvas 集成，Phase 5 |
| 手动触发重新生成单页 | 先保证自动生成的质量，后续再加手动控制 |
| 后端 Puppeteer 检测 | 前端 iframe 已足够，不增加部署复杂度 |
| 流式 HTML（token by token） | LLM 需要生成完整 HTML 才有意义，不适合 token 级流式 |

---

## 十一、开发任务拆解

```
Phase 4 HTML Slides 开发任务
├── T1: M5 模块 + Prompt 设计               (1 天)
├── T2: 并发控制 + Orchestrator 集成         (0.5 天)
├── T3: SSE 事件扩展 + 前端事件消费          (0.5 天)
├── T4: iframe 渲染组件 + 缩放逻辑           (0.5 天)
├── T5: 幻灯片浏览模式 + 翻页交互            (1 天)
├── T6: 缩略图导航条                         (0.5 天)
├── T7: 视图 Tab 切换 + 页面集成             (0.5 天)
├── T8: 爆版检测 + 重试逻辑                  (1 天)
├── T9: /api/generate-slide 重试 API        (0.5 天)
└── T10: 联调测试 + 体验打磨                 (1 天)
```

### 依赖关系

```
T1 ──┐
     ├── T2 ── T3 ── T7 ── T10
T4 ──┤         |
     ├── T5 ── T6
T8 ──┤
     └── T9
```

T1/T4/T8 可并行。T5/T6 可并行。实际并行后约 **4-5 天**可完成 MVP。

### 任务详情

**T1: M5 模块 + Prompt 设计 (1 天)**
- 创建 `m5-slide-renderer.ts`，实现 `renderSingleSlide()` 和 `renderSlidesToHtml()`
- 创建 `prompts/m5-slide.ts`，封装 prompt 模板
- 复用 `test-slide/route.ts` 中已验证的 prompt 结构
- 增加防爆版约束、页码上下文、重试模式

**T2: 并发控制 + Orchestrator 集成 (0.5 天)**
- 实现简易信号量 (Semaphore) 类
- 在 orchestrator 中 M4 完成后调用 M5
- 处理 M5 的回调，推送 SSE 事件

**T3: SSE 事件扩展 + 前端事件消费 (0.5 天)**
- 修改 `types/api.ts`，新增 SSE 事件类型
- 修改 `page.tsx` 的 `handleSSEEvent`，处理新事件
- 新增 `slideHtmls` 状态数组

**T4: iframe 渲染组件 + 缩放逻辑 (0.5 天)**
- 创建 `SlideIframe.tsx`，封装 iframe + 缩放
- 实现容器自适应缩放（ResizeObserver + transform:scale）
- 处理 iframe 加载状态

**T5: 幻灯片浏览模式 + 翻页交互 (1 天)**
- 创建 `SlidePreview.tsx` 主组件
- 左右翻页按钮 + 键盘事件
- 页码指示器
- 骨架屏/loading 状态

**T6: 缩略图导航条 (0.5 天)**
- 创建 `SlideThumbnailStrip.tsx`
- 小尺寸 iframe 缩略图
- 横向滚动 + 当前页高亮
- 点击跳转

**T7: 视图 Tab 切换 + 页面集成 (0.5 天)**
- 修改 `page.tsx`，新增 Tab 组件
- 大纲视图 / PPT 预览切换逻辑
- 自动切换触发条件

**T8: 爆版检测 + 重试逻辑 (1 天)**
- 创建 `lib/overflow-detector.ts`，隐藏 iframe 检测
- 创建 `hooks/useOverflowDetection.ts`，管理检测队列
- 重试流程实现：检测 -> 标记 -> 调用重试 API -> 替换
- 降级处理：CSS 注入 overflow:hidden

**T9: /api/generate-slide 重试 API (0.5 天)**
- 基于 `test-slide/route.ts` 正式化
- 支持 `isRetry` 参数
- 输入验证 (zod)

**T10: 联调测试 + 体验打磨 (1 天)**
- 端到端测试：从输入到 HTML 预览的完整流程
- 边界情况：空页面、超长内容、API 失败
- 进度指示器适配 M5 步骤
- 性能优化：多 iframe 渲染性能
- 错误提示优化

---

## 十二、成功指标

### 定量指标

| 指标 | 目标值 |
|------|--------|
| 12 页 PPT 的 HTML 生成总时间 | < 30 秒（不含重试） |
| 单页 HTML 生成耗时 | < 8 秒 |
| 首页 HTML 展示时间（从 M5 启动算起） | < 10 秒 |
| 首次生成爆版率 | < 20%（通过 prompt 优化降低） |
| 重试后爆版率 | < 5% |
| 爆版检测准确率 | > 95% |
| 前端 iframe 渲染帧率 | 60fps（翻页动画不卡顿） |

### 定性指标

- 用户能自然地从大纲过渡到 PPT 预览，无割裂感
- 翻页浏览体验流畅，类似 Google Slides 的查看模式
- 不同主题生成的 PPT 在配色和风格上有明显差异
- 爆版重试对用户透明，不产生困惑

---

## 十三、风险与应对

| 风险 | 概率 | 影响 | 应对策略 |
|------|------|------|---------|
| LLM 生成的 HTML 质量不稳定 | 中 | 高 | Prompt 持续优化 + 收集 bad case 迭代 |
| 3 并发触发 API 限流 | 低 | 中 | 降为 2 并发；增加退避等待 |
| 大页数 PPT (20+) 的 iframe 性能 | 中 | 中 | 缩略图虚拟化；销毁不可见 iframe |
| 前端 iframe 检测爆版不准确 | 低 | 中 | 增加容差；Google Fonts 加载可能影响布局 |
| HTML 中的 Google Fonts 加载缓慢 | 中 | 低 | 预加载常用字体；设置 fallback 字体 |
| Token 消耗增加导致用户 API 费用翻倍 | 高 | 中 | 明确告知用户；优化 prompt 减少 output tokens |
| SSE 连接超时（M4+M5 总时长可能超 60s） | 中 | 高 | 心跳事件保活；或 M5 用独立连接 |

### SSE 超时应对方案

整个流程（M1~M5）总时长可能达到 60-90 秒，部分环境（如 Vercel）的 SSE 连接可能超时。应对策略：

1. **心跳事件**：每 15 秒发送一个 `{ type: "heartbeat" }` 事件保持连接
2. **备选方案**：如果环境限制 SSE 时长，M5 可改为独立 API 调用（前端在收到 `outline` 事件后主动发起）

---

## 十四、后续演进方向

1. **手动重新生成单页** (Phase 5)：用户对某页不满意，点击按钮让 AI 重新生成
2. **缩略图总览模式** (Phase 5)：网格展示所有页面，全局审视
3. **全屏演示模式** (Phase 5)：按 F11 全屏，纯演示体验
4. **导出为图片/PDF** (Phase 5)：html2canvas 截图
5. **后端爆版检测** (Phase 6)：引入 Puppeteer 实现更精准的检测（如需要）
6. **模板系统** (Phase 6)：积累优质 HTML 输出作为 few-shot 样例，提升生成稳定性
7. **混合方案** (Phase 7)：简单页面用模板快速渲染，复杂/关键页面用 LLM 生成
