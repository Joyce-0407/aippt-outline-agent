/**
 * M3 故事线模块的类型定义
 */

/** PPT 章节 */
export interface Section {
  /** 章节标题 */
  title: string;
  /** 章节目的：这一章在整体故事中的作用 */
  purpose: string;
  /** 页码范围 [起始页码, 结束页码]，从 1 开始 */
  pageRange: [number, number];
  /** 章节核心信息 */
  keyMessage: string;
}

/** M3 故事线构建结果 */
export interface Storyline {
  /** 选择的叙事框架名称，如"问题驱动型"、"成果展示型"等 */
  narrativeFramework: string;
  /** 核心信息：受众听完后应记住的一句话 */
  coreMessage: string;
  /** 情感曲线描述，如"引发好奇 -> 展示机会 -> 呈现方案 -> 坚定信心" */
  emotionalCurve: string;
  /** 章节列表 */
  sections: Section[];
  /** 总页数 */
  totalPages: number;
}
