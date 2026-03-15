/**
 * 插件市场列表页 — 服务端组件入口
 *
 * 使用 Next.js ISR（Incremental Static Regeneration），
 * 服务端预取初始数据后传递给客户端交互组件。
 * revalidate = 60 秒，首屏无 loading。
 */

import { fetchPlugins } from '@/lib/services/marketplaceService';
import MarketplaceClient from './MarketplaceClient';

/** ISR：每 60 秒重新验证 */
export const revalidate = 60;

export default async function MarketplacePage() {
  // 服务端预取默认数据（热门排序、无筛选、第一页）
  const initialData = await fetchPlugins({
    sort: 'popular',
    page: 1,
    pageSize: 12,
  });

  return <MarketplaceClient initialData={initialData} />;
}
