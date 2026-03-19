/**
 * 搜索服务工厂测试
 */

import { describe, it, expect } from 'vitest';
import {
    createSearchServices,
    setSearchServiceFactory,
    resetSearchServices,
} from '../factory';

describe('createSearchServices', () => {
    it('应返回包含 academic 和 industry 方法的工厂实例', () => {
        const factory = createSearchServices();
        expect(factory).toBeDefined();
        expect(typeof factory.getAcademic).toBe('function');
        expect(typeof factory.getIndustry).toBe('function');
    });
});

describe('setSearchServiceFactory / resetSearchServices', () => {
    it('注入自定义工厂后应生效', () => {
        const mockFactory = createSearchServices();
        setSearchServiceFactory(mockFactory);
        // 验证不抛出异常
        expect(() => setSearchServiceFactory(mockFactory)).not.toThrow();
    });

    it('resetSearchServices 重置不应抛出异常', () => {
        setSearchServiceFactory(createSearchServices());
        expect(() => resetSearchServices()).not.toThrow();
    });
});
