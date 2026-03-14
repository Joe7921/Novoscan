import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { RegisterSW } from "@/components/pwa/register-sw";
import dynamic from "next/dynamic";
// ParticleBackground 已从全局移至首页组件内，减少非首页的 Canvas 开销


const RouteProgress = dynamic(() => import("@/components/layout/RouteProgress"), { ssr: false });

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://novoscan.cn';

export const metadata: Metadata = {
  // ============ 基础 SEO ============
  title: {
    default: 'Novoscan — 下一代创新评估垂直代理',
    template: '%s | Novoscan',
  },
  description:
    '全网首个多智能体 AI 创新评估引擎。数十秒穿透 2.5 亿学术论文 + 全球产业动态，6 名 AI 专家交叉验证，输出量化创新评分。视探创新查重、商业分析、趋势监控一站式服务，免费体验。',
  keywords: [
    // 核心品牌词
    'Novoscan', 'Bizscan', 'Clawscan', 'NovoTracker',
    // 高搜索量热词
    'AI创新查重', 'AI论文查新', 'AI商业分析', 'AI分析工具',
    'AI查重工具', '创新评估', '专利查新', '多智能体',
    // 蹭热度：论文查重关联词（超高搜索量）
    '论文查重', '论文查重工具', '免费查重', '论文查新',
    '查重软件', '论文重复率检测', '毕业论文查重', '论文原创性检测',
    '论文降重', 'AI论文检测', '学术不端检测',
    // 长尾词（竞争小、转化高）
    'AI创新性检测', '研究课题查重', '技术方案评估', '创业想法可行性',
    '多智能体AI平台', '论文创新性分析', '商业模式AI评估',
    // 场景化热词
    '毕业论文查新', '创业大赛评估', '科研基金申请', '产品创新分析',
    '创新趋势追踪', '学术论文分析', '行业竞品分析', 'AI创新情报',
    // 竞品关联词（截流）
    '知网查重替代', '维普查重', '万方查重', 'AI查重免费',
  ],
  authors: [{ name: 'Novoscan Team' }],
  creator: 'Novoscan',
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon-192x192.png',
  },
  manifest: '/manifest.json',

  // ============ Open Graph（微信/微博/Facebook 预览卡片）============
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: SITE_URL,
    siteName: 'Novoscan',
    title: 'Novoscan — 60秒穿透2.5亿论文的AI创新评估引擎',
    description:
      '多智能体协作的 AI 创新分析平台，视探创新查重 + 商业分析 + 趋势监控，免费体验。',
    images: [
      {
        url: `${SITE_URL}/og-brand.png`,
        width: 1200,
        height: 630,
        alt: 'Novoscan — AI 创新情报平台',
      },
      {
        url: `${SITE_URL}/icon-512x512.png`,
        width: 512,
        height: 512,
        alt: 'Novoscan Logo',
      },
    ],
  },

  // ============ Twitter Card ============
  twitter: {
    card: 'summary_large_image',
    title: 'Novoscan — AI 创新情报引擎，60秒深度分析',
    description:
      '多智能体 AI 创新分析平台，数十秒获取创新查重、商业分析、趋势监控全景报告。',
    images: [`${SITE_URL}/api/og?title=${encodeURIComponent('Novoscan — AI 创新情报引擎')}&type=novoscan`],
  },

  // ============ 其他 SEO ============
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'f-yEOgw0-va1LWoBXIFl2p07Lqz7nz7Pb5gn_5VRlks',
  },
};

// ============ Viewport 配置 ============
// 禁止移动端缩小页面（缩小会导致布局错位），保留放大功能以兼顾无障碍访问
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  // maximumScale 不设置，允许用户放大
  themeColor: '#0a0a0a',
};

// JSON-LD 结构化数据 — 帮助搜索引擎理解网站类型
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Novoscan',
  description: '基于多智能体协作的 AI 创新情报平台。提供创新查重、商业可行性分析、创新趋势追踪等一站式服务。',
  url: SITE_URL,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: 'zh-CN',
  keywords: 'AI创新检索,创新查重,商业可行性分析,多智能体,创新评估',
  featureList: [
    'Novoscan 学术+产业创新查重',
    'Bizscan 商业可行性 AI 分析',
    'Clawscan Skill 查重与评估',
    'NovoTracker 创新趋势监控',
    'NovoDNA 创新基因图谱',
    'NovoDebate AI 辩论引擎',
  ],
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'CNY',
    description: '免费体验 AI 创新检索与评估',
  },
  creator: {
    '@type': 'Organization',
    name: 'Novoscan Team',
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512x512.png`,
  },
};

// Organization 结构化数据 — 帮助 Google Knowledge Panel 展示品牌信息
const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Novoscan',
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512x512.png`,
  description: '基于多智能体协作的 AI 创新情报平台',
  foundingDate: '2024',
  sameAs: [],
};

// WebSite JSON-LD — Google 搜索结果显示站内搜索框（Sitelinks Searchbox）
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Novoscan',
  url: SITE_URL,
  description: '多智能体 AI 创新评估引擎',
  inLanguage: 'zh-CN',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

// BreadcrumbList JSON-LD — Google 搜索结果显示面包屑导航
const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: '首页', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: '创新查重', item: `${SITE_URL}/skill-check` },
    { '@type': 'ListItem', position: 3, name: '商业分析', item: `${SITE_URL}/bizscan` },
    { '@type': 'ListItem', position: 4, name: '趋势洞察', item: `${SITE_URL}/trends` },
    { '@type': 'ListItem', position: 5, name: '趋势监控', item: `${SITE_URL}/tracker` },
    { '@type': 'ListItem', position: 6, name: '技术文档', item: `${SITE_URL}/docs` },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <head>
        {/* 性能优化 — preconnect 外部域，提升 Core Web Vitals */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://zz.bdstatic.com" />
        <link rel="dns-prefetch" href="https://api.openalex.org" />
        {/* PWA — iOS Safari 兼容标签 */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Novoscan" />

        {/* 国内搜索引擎专属标签 */}
        <meta name="applicable-device" content="pc,mobile" />
        <meta name="MobileOptimized" content="width" />
        <meta name="HandheldFriendly" content="true" />
        {/* 百度站长验证 */}
        <meta name="baidu-site-verification" content="codeva-YrQmhqSfhf" />
        {/* 360搜索验证 */}
        {/* <meta name="360-site-verification" content="待填入" /> */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        {/* 全局 Chunk 加载失败恢复脚本 — 在 React 渲染前拦截 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                window.addEventListener('error', function(e) {
                  var msg = (e.message || '') + ' ' + ((e.filename || ''));
                  if (msg.indexOf('Loading chunk') !== -1 ||
                      msg.indexOf('Failed to fetch dynamically imported module') !== -1 ||
                      msg.indexOf('ChunkLoadError') !== -1) {
                    var key = 'novoscan-chunk-reload';
                    if (!sessionStorage.getItem(key)) {
                      sessionStorage.setItem(key, '1');
                      window.location.reload();
                    } else {
                      sessionStorage.removeItem(key);
                    }
                  }
                });
              })();
            `,
          }}
        />
        {/* 百度自动推送 — 页面加载即通知百度收录 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var bp = document.createElement('script');
                var curProtocol = window.location.protocol.split(':')[0];
                bp.src = (curProtocol === 'https' ? 'https://zz.bdstatic.com/linksubmit/push.js' : 'http://push.zhanzhang.baidu.com/push.js');
                bp.defer = true;
                document.head.appendChild(bp);
              })();
            `,
          }}
        />
        {/* Google AdSense — 全局广告脚本（需配置 NEXT_PUBLIC_ADSENSE_CLIENT 环境变量） */}
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-gray-900 dark:text-slate-100 dark:bg-dark-base selection:bg-google-blue selection:text-white relative min-h-screen overflow-x-hidden`}
      >
        {children}
        <RouteProgress />
        <RegisterSW />

      </body>
    </html>
  );
}
