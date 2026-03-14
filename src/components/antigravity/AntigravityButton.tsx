'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { ANTIGRAVITY_SHAPES } from '@/lib/constants/theme';
import { ReactNode } from 'react';

interface AntigravityButtonProps extends HTMLMotionProps<'button'> {
    children: ReactNode;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg' | 'giant';
    icon?: ReactNode;
}

export default function AntigravityButton({
    children,
    variant = 'primary',
    size = 'md',
    icon,
    className = '',
    ...props
}: AntigravityButtonProps) {

    const baseStyles = "relative inline-flex items-center justify-center font-bold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 overflow-hidden";

    // Enforcing the strict pill shape
    const roundedStyle = "rounded-full";

    const sizeStyles = {
        sm: "px-4 py-2 text-xs",
        md: "px-6 py-3 text-sm",
        lg: "px-8 py-4 text-base",
        giant: "px-12 py-5 text-xl lg:text-2xl",
    };

    const variantStyles = {
        // 暗色模式中基础色反转：主色变品牌蓝并带辉光
        primary: "bg-gray-900 text-white hover:bg-black focus:ring-black dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500 dark:focus:ring-blue-500 dark:shadow-[0_0_20px_rgba(37,99,235,0.4)] dark:hover:shadow-[0_0_25px_rgba(59,130,246,0.6)]",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-200 dark:bg-dark-elevated dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:ring-slate-600 dark:border dark:border-slate-700",
        outline: "border-2 border-gray-900 text-gray-900 hover:bg-gray-50 focus:ring-gray-900 dark:border-2 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-dark-elevated dark:focus:ring-slate-400",
        ghost: "bg-transparent text-gray-900 hover:bg-gray-100 focus:ring-gray-200 dark:text-slate-300 dark:hover:bg-dark-elevated dark:focus:ring-slate-600",
    };

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={ANTIGRAVITY_SHAPES.springPhysics}
            className={`${baseStyles} ${roundedStyle} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
            {...props}
        >
            {/* Optional Glow Effect on Hover (can be expanded via CSS) */}
            <motion.div
                className="absolute inset-0 bg-white/95 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-300"
                aria-hidden="true"
            />

            {icon && <span className="mr-2 flex-shrink-0">{icon}</span>}
            <span className="relative z-10">{children}</span>
        </motion.button>
    );
}
