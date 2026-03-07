"use client";

/**
 * 进度指示器组件
 * 展示 [文档解析（可选）] -> M1（分析需求）-> M3（构建故事线）-> M4（生成大纲）的执行进度
 */

/** 单个步骤的状态 */
export type StepStatus = "waiting" | "running" | "done" | "error" | "hidden";

/** 进度状态集合（parse 步骤仅在有文档时显示） */
export interface ProgressState {
  parse?: StepStatus;
  intent: StepStatus;
  storyline: StepStatus;
  research: StepStatus;
  outline: StepStatus;
}

/** 进度步骤定义 */
const ALL_STEPS = [
  {
    key: "parse" as const,
    label: "文档解析",
    description: "提取文档结构与内容",
    optional: true,  // 可选步骤，无文档时隐藏
  },
  {
    key: "intent" as const,
    label: "分析需求",
    description: "理解 PPT 用途与受众",
    optional: false,
  },
  {
    key: "storyline" as const,
    label: "构建故事线",
    description: "规划叙事框架与章节",
    optional: false,
  },
  {
    key: "research" as const,
    label: "联网检索",
    description: "补充外部事实与案例",
    optional: false,
  },
  {
    key: "outline" as const,
    label: "生成大纲",
    description: "逐页生成详细内容",
    optional: false,
  },
];

interface ProgressIndicatorProps {
  progress: ProgressState;
  /** 是否有上传的文档（控制是否显示"文档解析"步骤） */
  hasDocuments?: boolean;
}

/** 根据步骤状态渲染对应的图标 */
function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (status === "running") {
    return (
      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
        <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }
  // waiting / hidden 状态（hidden 状态不会被渲染到 DOM，此处是兜底）
  return (
    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
      <div className="w-3 h-3 rounded-full bg-gray-400" />
    </div>
  );
}

/** 步骤状态对应的文字颜色 */
function getStepTextColor(status: StepStatus): string {
  if (status === "done") return "text-green-600";
  if (status === "running") return "text-blue-600";
  if (status === "error") return "text-red-600";
  return "text-gray-400";
}

/** 连接线的样式 */
function getConnectorColor(status: StepStatus): string {
  if (status === "done") return "bg-green-300";
  return "bg-gray-200";
}

export default function ProgressIndicator({ progress, hasDocuments }: ProgressIndicatorProps) {
  // 根据是否有文档决定显示哪些步骤
  const visibleSteps = ALL_STEPS.filter((step) => {
    if (step.key === "parse") return hasDocuments;
    return true;
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-4">生成进度</h3>

      <div className="flex items-center justify-between">
        {visibleSteps.map((step, index) => {
          // parse 步骤在 progress 中可能没有状态，默认 "waiting"
          const status: StepStatus =
            step.key === "parse"
              ? (progress.parse ?? "waiting")
              : progress[step.key];

          return (
            <div key={step.key} className="flex items-center">
              {/* 步骤内容 */}
              <div className="flex flex-col items-center text-center" style={{ minWidth: "90px" }}>
                <StepIcon status={status} />
                <span className={`mt-2 text-sm font-medium ${getStepTextColor(status)}`}>
                  {step.label}
                </span>
                <span className="mt-0.5 text-xs text-gray-400 hidden sm:block">
                  {step.description}
                </span>
              </div>

              {/* 步骤之间的连接线（最后一个步骤不需要） */}
              {index < visibleSteps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-3 transition-colors duration-500 ${getConnectorColor(status)}`}
                  style={{ minWidth: "40px" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
