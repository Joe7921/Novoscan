/**
 * 页面过渡动画 — 使用纯 CSS 替代 framer-motion，
 * 避免将 ~50KB 的 framer-motion 拉入全局 JS bundle，大幅优化移动端首屏加载。
 */
export default function Template({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="relative z-10 min-h-screen flex flex-col animate-page-enter"
        >
            {children}
        </div>
    );
}
