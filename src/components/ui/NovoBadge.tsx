'use client';

import React from 'react';

/* ===================================================================
 * NovoBadge — 统一状态标签/徽标原子组件
 * =================================================================== */

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md';

interface NovoBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** 带圆点指示器 */
  dot?: boolean;
  /** 圆点颜色 */
  dotColor?: string;
  icon?: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[var(--novo-bg-hover)] text-[var(--novo-text-secondary)] border-[var(--novo-border-default)]',
  primary: 'bg-[var(--novo-accent-primary-light)] text-[var(--novo-accent-primary)] border-[var(--novo-accent-primary)]/20',
  success: 'bg-[var(--novo-accent-success-light)] text-[var(--novo-accent-success)] border-[var(--novo-accent-success)]/20',
  warning: 'bg-[var(--novo-accent-warning-light)] text-[var(--novo-accent-warning)] border-[var(--novo-accent-warning)]/20',
  danger: 'bg-[var(--novo-accent-danger-light)] text-[var(--novo-accent-danger)] border-[var(--novo-accent-danger)]/20',
  info: 'bg-[var(--novo-accent-info-light)] text-[var(--novo-accent-info)] border-[var(--novo-accent-info)]/20',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

const NovoBadge: React.FC<NovoBadgeProps> = ({
  variant = 'default',
  size = 'md',
  dot = false,
  dotColor,
  icon,
  className = '',
  children,
  ...props
}) => {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 font-bold rounded-full border',
        'whitespace-nowrap select-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
          style={{
            backgroundColor: dotColor || 'currentColor',
          }}
        />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
};

export default NovoBadge;
