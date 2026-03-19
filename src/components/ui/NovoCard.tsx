'use client';

import React from 'react';

/* ===================================================================
 * NovoCard — 统一卡片原子组件
 * 替代 AntigravityCard 和分散的卡片 div
 * 使用 Design Token CSS 变量驱动
 * =================================================================== */

export type CardVariant = 'default' | 'elevated' | 'glass' | 'outlined' | 'interactive';

interface NovoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 卡片风格变体 */
  variant?: CardVariant;
  /** 鼠标悬停效果 */
  hoverEffect?: boolean;
  /** 内边距（使用 Design Token spacing） */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** 作为 button/link 使用时的可点击状态 */
  clickable?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'novo-card',
  elevated: 'novo-elevated',
  glass: 'glassmorphism dark:glassmorphism-dark rounded-2xl',
  outlined: 'bg-transparent border border-[var(--novo-border-default)] rounded-2xl',
  interactive: 'novo-card cursor-pointer active:scale-[0.98]',
};

const paddingClasses: Record<string, string> = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-6',
  lg: 'p-6 sm:p-8',
};

const NovoCard = React.forwardRef<HTMLDivElement, NovoCardProps>(
  (
    {
      variant = 'default',
      hoverEffect = false,
      padding = 'md',
      clickable = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={[
          variantStyles[variant],
          paddingClasses[padding],
          hoverEffect
            ? 'hover:-translate-y-1 hover:shadow-novo-lg transition-all duration-300'
            : '',
          clickable ? 'cursor-pointer' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </div>
    );
  }
);

NovoCard.displayName = 'NovoCard';
export default NovoCard;
