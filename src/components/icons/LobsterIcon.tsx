import React from 'react';

export const LobsterIcon = ({ className = '' }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        {/* Left claw */}
        <path d="M3 3c0 2 1 4 3 6l1-2c0-3-2-4-4-4Z" />
        <path d="M6 9c1-1 2-1 3-1l-1-2c-2 0-3 1-4 2l2 1Z" />
        {/* Right claw */}
        <path d="M21 3c0 2-1 4-3 6l-1-2c0-3 2-4 4-4Z" />
        <path d="M18 9c-1-1-2-1-3-1l1-2c2 0 3 1 4 2l-2 1Z" />
        {/* Body */}
        <path d="M12 7c-2 0-3 2-3 4v3c0 1.5 1 3 3 3s3-1.5 3-3v-3c0-2-1-4-3-4Z" />
        {/* Tail */}
        <path d="M12 17v4" />
        <path d="M9 19h6" />
        <path d="M8 21h8" />
        {/* Legs */}
        <path d="M9 11H5" />
        <path d="M9 14H6" />
        <path d="M15 11h4" />
        <path d="M15 14h3" />
    </svg>
);
