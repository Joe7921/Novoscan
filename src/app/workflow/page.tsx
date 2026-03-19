/**
 * 工作流管理页面 — 服务端入口
 *
 * 传递预设列表到客户端交互组件。
 */

import { listPresets } from '@/workflow/validator';
import WorkflowClient from './WorkflowClient';

export const metadata = {
    title: '工作流管理 — Novoscan',
    description: '选择、管理和自定义分析工作流管线',
};

export default function WorkflowPage() {
    const presets = listPresets();
    return <WorkflowClient presets={presets} />;
}
