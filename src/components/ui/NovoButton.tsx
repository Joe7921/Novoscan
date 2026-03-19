'use client';

import React from 'react';

/* ===================================================================
 * NovoButton — 统一按钮原子组件
 * 替代分散的 AntigravityButton、内联 button 元素
 * 使用 Design Token CSS 变量驱动，支持完全自定义
 * =================================================================== */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface NovoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮风格变体 */
  variant?: ButtonVariant;
  /** 按钮尺寸 */
  size?: ButtonSize;
  /** 前置图标 */
  icon?: React.ReactNode;
  /** 后置图标 */
  iconRight?: React.ReactNode;
  /** 加载状态 */
  loading?: boolean;
  /** 占满父容器宽度 */
  fullWidth?: boolean;
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs gap-1 rounded-md',
  sm: 'px-3 py-1.5 text-sm gap-1.5 rounded-lg',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-xl',
  lg: 'px-6 py-3 text-base gap-2.5 rounded-2xl',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'novo-btn-primary',
  secondary: 'novo-btn-secondary',
  ghost: 'novo-btn-ghost',
  danger: 'bg-[var(--novo-accent-danger)] text-white hover:brightness-110',
  success: 'bg-[var(--novo-accent-success)] text-white hover:brightness-110',
};

const NovoButton = React.forwardRef<HTMLButtonElement, NovoButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      iconRight,
      loading = false,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          'novo-btn',
          sizeClasses[size],
          variantClasses[variant],
          'font-semibold',
          'transition-all duration-150',
          fullWidth ? 'w-full' : '',
          isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {loading ? (
          <svg
            className="animate-spin w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : icon ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        {children && <span>{children}</span>}
        {iconRight && <span className="flex-shrink-0">{iconRight}</span>}
      </button>
    );
  }
);

NovoButton.displayName = 'NovoButton';
export default NovoButton;
