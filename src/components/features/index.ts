/**
 * 功能模块组件统一导出
 *
 * src/components/features/ 按功能划分：
 *   - analysis/    分析报告
 *   - home/        首页
 *   - thinking/    分析中动画
 *   - discovery/   追问/趋势面板
 *   - debate/      辩论展示
 *   - innovation/  创新 DNA / 雷达图
 *   - data/        数据源展示
 *   - report/      报告展示
 *   - settings/    设置页
 *   - tracker/     NovoTracker
 *   - bizscan/     Bizscan
 *   - novomind/    NovoMind
 *   - agent/       Agent 展示
 *
 * 注意：各模块在自己的目录下，不在此处全部 re-export。
 * 此文件仅提供目录说明和跨模块常用导出。
 */

// 跨功能常用的报告组件
export { ScoreTooltip } from '@/components/report/ScoreTooltip';

// Agent 展示组件
export { default as AgentRawDisplay } from '@/components/agent/AgentRawDisplay';
export type { AgentRawItem } from '@/components/agent/AgentRawDisplay';
