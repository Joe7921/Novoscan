'use client';

/**
 * Next.js App Router 全局加载骨架屏
 * 当路由切换时自动显示，消除页面间的白屏过渡
 */
export default function Loading() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 relative overflow-hidden">
            {/* 装饰光斑 — 与品牌风格一致 */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-novo-blue/5 rounded-full blur-[100px] animate-pulse pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-novo-red/5 rounded-full blur-[100px] animate-pulse pointer-events-none" style={{ animationDelay: '0.5s' }} />
            <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] bg-novo-yellow/5 rounded-full blur-[80px] animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} />

            {/* 品牌 Logo 旋转动画 */}
            <div className="relative flex items-center justify-center w-20 h-20 mb-8">
                <div className="absolute w-full h-full rounded-full border-4 border-novo-blue/10" />
                <div
                    className="absolute w-full h-full rounded-full border-4 border-novo-blue border-r-transparent border-b-transparent animate-spin"
                    style={{ animationDuration: '1s' }}
                />
                <div className="absolute w-12 h-12 rounded-full border-4 border-novo-red/10" />
                <div
                    className="absolute w-12 h-12 rounded-full border-4 border-novo-red border-l-transparent border-t-transparent animate-spin"
                    style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}
                />
            </div>

            {/* 品牌文字 */}
            <p className="text-gray-500 font-medium tracking-widest text-sm animate-pulse">
                <span className="text-novo-blue">N</span>{' '}
                <span className="text-novo-red">O</span>{' '}
                <span className="text-novo-yellow">V</span>{' '}
                <span className="text-novo-blue">O</span>
                <span className="ml-2">LOADING...</span>
            </p>

            {/* 扫光进度条 */}
            <div className="mt-6 w-48 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className="h-full w-2/5 bg-gradient-to-r from-novo-blue via-novo-red to-novo-yellow rounded-full"
                    style={{ animation: 'loading-bar 2s ease-in-out infinite' }}
                />
            </div>
        </div>
    );
}
