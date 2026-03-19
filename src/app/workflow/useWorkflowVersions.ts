/**
 * useWorkflowVersions — 工作流版本管理 Hook
 *
 * 基于 localStorage 的版本快照管理。
 * 每次保存时自动创建版本快照，支持版本列表、回退、删除。
 *
 * 存储键：novoscan_wf_versions_{workflowId}
 *
 * @module workflow/useWorkflowVersions
 */

import { useState, useCallback, useEffect } from 'react';

// ==================== 类型定义 ====================

/** 单个版本快照 */
export interface WorkflowVersion {
    /** 版本号（自增） */
    version: number;
    /** 创建时间戳 */
    timestamp: number;
    /** 版本描述（自动生成或用户备注） */
    description: string;
    /** 节点数量 */
    nodeCount: number;
    /** 工作流完整 JSON 快照 */
    snapshot: Record<string, unknown>;
}

/** 存储键前缀 */
const VERSION_KEY_PREFIX = 'novoscan_wf_versions_';

/** 最大保留版本数 */
const MAX_VERSIONS = 20;

// ==================== 工具函数 ====================

function getStorageKey(workflowId: string): string {
    return `${VERSION_KEY_PREFIX}${workflowId}`;
}

function loadVersions(workflowId: string): WorkflowVersion[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(getStorageKey(workflowId));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveVersions(workflowId: string, versions: WorkflowVersion[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getStorageKey(workflowId), JSON.stringify(versions));
}

// ==================== Hook 主体 ====================

export function useWorkflowVersions(workflowId: string) {
    const [versions, setVersions] = useState<WorkflowVersion[]>([]);

    // 初始化加载
    useEffect(() => {
        if (workflowId) {
            setVersions(loadVersions(workflowId));
        }
    }, [workflowId]);

    /**
     * 创建新版本快照
     *
     * @param snapshot - 工作流完整 JSON
     * @param description - 可选的版本描述
     * @returns 新创建的版本
     */
    const createVersion = useCallback((
        snapshot: Record<string, unknown>,
        description?: string
    ): WorkflowVersion => {
        const existing = loadVersions(workflowId);
        const nextVersion = existing.length > 0
            ? Math.max(...existing.map(v => v.version)) + 1
            : 1;

        const nodes = snapshot.nodes as unknown[] | undefined;
        const now = Date.now();
        const timeStr = new Date(now).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

        const newVersion: WorkflowVersion = {
            version: nextVersion,
            timestamp: now,
            description: description || `v${nextVersion} — ${timeStr} 保存`,
            nodeCount: nodes?.length || 0,
            snapshot: JSON.parse(JSON.stringify(snapshot)), // 深拷贝
        };

        // 插入到最前面，限制最大数量
        const updated = [newVersion, ...existing].slice(0, MAX_VERSIONS);
        saveVersions(workflowId, updated);
        setVersions(updated);

        return newVersion;
    }, [workflowId]);

    /**
     * 回退到指定版本
     *
     * @param version - 版本号
     * @returns 该版本的快照 JSON，不存在返回 null
     */
    const rollback = useCallback((version: number): Record<string, unknown> | null => {
        const target = versions.find(v => v.version === version);
        return target ? target.snapshot : null;
    }, [versions]);

    /**
     * 删除指定版本
     */
    const deleteVersion = useCallback((version: number): void => {
        const updated = versions.filter(v => v.version !== version);
        saveVersions(workflowId, updated);
        setVersions(updated);
    }, [versions, workflowId]);

    /**
     * 清空所有版本
     */
    const clearAll = useCallback((): void => {
        saveVersions(workflowId, []);
        setVersions([]);
    }, [workflowId]);

    return {
        versions,
        createVersion,
        rollback,
        deleteVersion,
        clearAll,
        versionCount: versions.length,
    };
}
