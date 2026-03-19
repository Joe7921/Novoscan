'use client';

import React from 'react';

/* ===================================================================
 * NovoSkeleton — 统一骨架屏原子组件
 * 替代分散在各 loading 回调中的骨架 JSX
 * =================================================================== */

interface NovoSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 宽度（CSS 值） */
  width?: string | number;
  /** 高度（CSS 值） */
  height?: string | number;
  /** 形状 */
  variant?: 'text' | 'rect' | 'circle';
  /** 是否显示动画 */
  animate?: boolean;
}

const NovoSkeleton: React.FC<NovoSkeletonProps> = ({
  width,
  height,
  variant = 'rect',
  animate = true,
  className = '',
  style,
  ...props
}) => {
  const shapeClasses = {
    text: 'rounded-md',
    rect: 'rounded-xl',
    circle: 'rounded-full',
  };

  return (
    <div
      className={[
        'bg-gray-200 dark:bg-slate-700',
        shapeClasses[variant],
        animate ? 'animate-pulse' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      {...props}
    />
  );
};

/* === 预组合骨架屏模式 === */

/** 卡片骨架屏 */
export const SkeletonCard: React.FC<{ rows?: number; className?: string }> = ({
  rows = 3,
  className = '',
}) => (
  <div
    className={`novo-card p-5 animate-pulse ${className}`}
  >
    <NovoSkeleton width="60%" height={20} className="mb-3" />
    {Array.from({ length: rows }).map((_, i) => (
      <NovoSkeleton
        key={i}
        width={`${85 - i * 10}%`}
        height={14}
        variant="text"
        className="mb-2"
      />
    ))}
  </div>
);

/** 列表项骨架屏 */
export const SkeletonListItem: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <div className={`flex items-center gap-3 p-4 animate-pulse ${className}`}>
    <NovoSkeleton width={40} height={40} variant="circle" />
    <div className="flex-1">
      <NovoSkeleton width="40%" height={16} className="mb-2" />
      <NovoSkeleton width="70%" height={12} variant="text" />
    </div>
  </div>
);

/** 网格骨架屏 */
export const SkeletonGrid: React.FC<{
  cols?: number;
  rows?: number;
  className?: string;
}> = ({ cols = 4, rows = 1, className = '' }) => (
  <div
    className={`grid gap-4 ${className}`}
    style={{
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    }}
  >
    {Array.from({ length: cols * rows }).map((_, i) => (
      <SkeletonCard key={i} rows={2} />
    ))}
  </div>
);

export default NovoSkeleton;
