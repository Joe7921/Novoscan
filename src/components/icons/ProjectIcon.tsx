import React from 'react';

/**
 * ProjectIcon — Novoscan 品牌 Logo 图标
 *
 * 经典线条风格：四角星 + 右上十字 + 左下圆点
 */
export const ProjectIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        {/* Center star */}
        <path d="M12 4C12 8.4 8.4 12 4 12C8.4 12 12 15.6 12 20C12 15.6 15.6 12 20 12C15.6 12 12 8.4 12 4Z" />

        {/* Top Right plus/star */}
        <path d="M19 2v4" />
        <path d="M17 4h4" />

        {/* Bottom Left circle */}
        <circle cx="5" cy="19" r="1.5" />
    </svg>
);
