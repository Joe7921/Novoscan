/**
 * SSE 事件流解析器
 *
 * 从 fetch Response 读取 Server-Sent Events，
 * 逐条解析并通过回调分发给消费者。
 */

export interface SSEEvent {
  event: string
  data: Record<string, unknown>
}

export type SSECallback = (evt: SSEEvent) => void

/**
 * 消费 SSE 流 — 从 fetch Response 中逐行解析事件
 */
export async function consumeSSE(
  response: Response,
  onEvent: SSECallback,
  onError?: (err: Error) => void,
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) {
    onError?.(new Error('Response body is null'))
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''
  let currentData = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6)
        } else if (line === '') {
          // 空行 = 事件结束
          if (currentEvent && currentData) {
            try {
              const data = JSON.parse(currentData)
              onEvent({ event: currentEvent, data })
            } catch {
              // JSON 解析失败，跳过
            }
          }
          currentEvent = ''
          currentData = ''
        }
      }
    }
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)))
  } finally {
    reader.releaseLock()
  }
}
