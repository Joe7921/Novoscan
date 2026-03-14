'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { ANTIGRAVITY_SHAPES } from '@/lib/constants/theme';
import { ReactNode } from 'react';

interface AntigravityCardProps extends HTMLMotionProps<'div'> {
    children: ReactNode;
    hoverEffect?: boolean;
    glassmorphism?: boolean;
}

export default function AntigravityCard({
    children,
    hoverEffect = true,
    glassmorphism = false,
    className = '',
    ...props
}: AntigravityCardProps) {

    // Giant rounded corners (4xl = 32px, 5xl = 48px)
    const baseStyles = "relative overflow-hidden rounded-4xl md:rounded-5xl p-6 md:p-10 lg:p-12";

    const bgStyles = glassmorphism
        ? "bg-white/95 dark:bg-dark-surface/50 border border-white/40 dark:border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.05)]"
        : "bg-white/95 dark:bg-dark-surface/50 border border-gray-200/80 dark:border-[#1E293B]/80 shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]";

    return (
        <motion.div
            whileHover={hoverEffect ? {
                y: -10,
                scale: 1.01,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)"
            } : {}}
            transition={ANTIGRAVITY_SHAPES.springPhysics}
            className={`${baseStyles} ${bgStyles} ${className}`}
            {...props}
        >
            {children}
        </motion.div>
    );
}
