'use client';

import { useEffect } from 'react';

/**
 * 全局错误边界 — 处理 Chunk 加载失败等运行时错误
 * 
 * 当 Vercel 部署新版本后，用户浏览器缓存的旧 HTML 可能引用已不存在的 chunk 文件，
 * 导致 "Loading chunk XXXX failed" 错误。此组件会自动检测并刷新页面恢复。
 * 
 * #28 支持中英文国际化
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    // 检测浏览器语言偏好或用户设置
    const isZh = typeof navigator !== 'undefined'
        ? navigator.language?.startsWith('zh')
        : true;

    useEffect(() => {
        // 检测是否为 Chunk 加载失败错误
        const isChunkLoadError =
            error.name === 'ChunkLoadError' ||
            error.message?.includes('Loading chunk') ||
            error.message?.includes('Failed to fetch dynamically imported module') ||
            error.message?.includes('Importing a module script failed');

        if (isChunkLoadError) {
            // 使用 sessionStorage 防止无限刷新循环
            const reloadKey = 'chunk-reload-attempted';
            const hasReloaded = sessionStorage.getItem(reloadKey);

            if (!hasReloaded) {
                sessionStorage.setItem(reloadKey, 'true');
                // 强制刷新页面以获取最新的 chunk
                window.location.reload();
            } else {
                // 已经尝试过刷新了，清除标记
                sessionStorage.removeItem(reloadKey);
            }
        }
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
            <div className="text-center p-8 max-w-md mx-auto">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>
                <h2 className="text-xl font-semibold text-white mb-3">
                    {isZh ? '应用发生全局错误' : 'Something went wrong'}
                </h2>
                <p className="text-gray-400 mb-6 text-sm leading-relaxed">
                    {isZh
                        ? '应用已更新到新版本，请刷新页面加载最新内容。如果问题持续，请清除浏览器缓存后重试。'
                        : 'The application has been updated. Please refresh the page to load the latest version. If the issue persists, try clearing your browser cache.'}
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => window.location.reload()}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        {isZh ? '刷新页面' : 'Refresh Page'}
                    </button>
                    <button
                        onClick={reset}
                        className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors text-sm font-medium"
                    >
                        {isZh ? '尝试恢复' : 'Try to Recover'}
                    </button>
                </div>
            </div>
        </div>
    );
}
