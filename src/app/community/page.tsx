/**
 * 社区工作流市场 — 服务端入口
 *
 * 展示社区分享的工作流模板，支持一键导入。
 */

import CommunityClient from './CommunityClient';

export const metadata = {
    title: '社区工作流市场 — Novoscan',
    description: '浏览社区分享的工作流模板，一键导入使用',
};

export default function CommunityPage() {
    return <CommunityClient />;
}
