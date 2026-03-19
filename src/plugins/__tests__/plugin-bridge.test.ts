/**
 * 插件桥接器测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { bridgePluginsToAgentRegistry, resetBridge } from '../plugin-bridge';

describe('bridgePluginsToAgentRegistry', () => {
    beforeEach(() => {
        resetBridge();
    });

    it('应返回桥接结果对象', () => {
        const result = bridgePluginsToAgentRegistry();
        expect(result).toBeDefined();
        expect(typeof result.bridged).toBe('number');
        expect(typeof result.skipped).toBe('number');
        expect(Array.isArray(result.errors)).toBe(true);
    });

    it('二次调用应跳过已桥接的 Agent（幂等性）', () => {
        const first = bridgePluginsToAgentRegistry();
        const second = bridgePluginsToAgentRegistry();
        expect(second.skipped).toBe(first.bridged);
        expect(second.bridged).toBe(0);
    });

    it('resetBridge 后可重新桥接', () => {
        const first = bridgePluginsToAgentRegistry();
        resetBridge();
        const third = bridgePluginsToAgentRegistry();
        expect(third.bridged).toBe(first.bridged);
    });
});
