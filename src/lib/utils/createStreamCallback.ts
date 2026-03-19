/**
 * createStreamCallback — SSE 流式回调工厂
 *
 * 统一 handleAnalyze 和 handleRefine 中重复的 SSE 回调逻辑。
 */

import type { StreamProgress } from '@/contexts/AnalysisContext';

type StreamProgressSetter = React.Dispatch<React.SetStateAction<StreamProgress>>;

interface StreamCallbackOptions {
  /** 追问精化标题回调 */
  onRefineTitle?: (title: string) => void;
}

/**
 * 创建标准化的 SSE 流式进度回调
 *
 * @param setter  - StreamProgress 状态更新函数
 * @param options - 可选扩展（如 refine_title 回调）
 * @returns 标准 (type, data) => void 回调函数
 */
export function createStreamCallback(
  setter: StreamProgressSetter,
  options?: StreamCallbackOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (type: string, data: any) => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (type: string, data: any) => {
    switch (type) {
      case 'log':
        setter(prev => ({ ...prev, currentLog: data }));
        break;
      case 'progress':
        setter(prev => ({ ...prev, globalProgress: data }));
        break;
      case 'agent_state':
        setter(prev => ({
          ...prev,
          agentProgress: {
            ...prev.agentProgress,
            [data.agentId]: data.update,
          },
        }));
        break;
      case 'agent_stream':
        setter(prev => ({
          ...prev,
          agentStreams: {
            ...prev.agentStreams,
            ...(data.debateExchange
              ? {
                  [`${data.agentId}_round${data.round}`]: JSON.stringify({
                    debateExchange: data.debateExchange,
                    sessionId: data.sessionId,
                    round: data.round,
                  }),
                }
              : {
                  [data.agentId]:
                    (prev.agentStreams[data.agentId] || '') + (data.chunk || ''),
                }),
          },
        }));
        break;
      case 'context_ready':
        setter(prev => ({ ...prev, contextData: data }));
        break;
      case 'refine_title':
        options?.onRefineTitle?.(data);
        break;
    }
  };
}
