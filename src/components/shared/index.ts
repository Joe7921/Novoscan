/**
 * 共享组件统一导出
 *
 * src/components/shared/ 聚合跨功能通用组件：
 *   - ui/       基础 UI 原件
 *   - layout/   布局组件
 *   - icons/    SVG 图标
 *   - pwa/      PWA 组件
 *   - antigravity/ 设计系统组件（Card/Button 等）
 */

// 基础 UI 组件
export { default as ErrorModal } from '@/components/ui/ErrorModal';
export { default as ModalPortal } from '@/components/ui/ModalPortal';
export { default as PrivacyToggle } from '@/components/ui/PrivacyToggle';
export { showToast, default as Toast } from '@/components/ui/Toast';
export { default as SearchHistory } from '@/components/ui/SearchHistory';

// 设计系统组件
export { default as AntigravityCard } from '@/components/antigravity/AntigravityCard';
export { default as AntigravityButton } from '@/components/antigravity/AntigravityButton';

// 布局组件
export { default as SiteFooter } from '@/components/layout/SiteFooter';
