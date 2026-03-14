'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * ModalPortal — 将子元素通过 React Portal 渲染到 document.body
 *
 * 解决 CSS `backdrop-filter` / `filter` / `transform` 等属性
 * 创建新包含块(containing block)导致内部 `position: fixed` 元素
 * 不再相对视口定位的经典问题。
 */
export default function ModalPortal({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    return createPortal(children, document.body);
}
