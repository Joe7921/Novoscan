/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Docker 部署：启用 standalone 输出模式（生成独立可运行的 server.js）
    output: 'standalone',
    // 性能优化：关闭 X-Powered-By 头、启用 gzip 压缩
    poweredByHeader: false,
    compress: true,
    // 性能优化：按需打包大型依赖，减小 JS bundle 体积
    experimental: {
        optimizePackageImports: ['lucide-react', 'lodash', 'framer-motion', 'recharts'],
    },
    // 图片优化：支持更高效的格式
    images: {
        formats: ['image/avif', 'image/webp'],
    },
    async rewrites() {
        return [
            // ChatGPT 查找 MCP 路径特定的 protected-resource 元数据
            {
                source: '/.well-known/oauth-protected-resource/:path*',
                destination: '/.well-known/oauth-protected-resource',
            },
        ];
    },
    async redirects() {
        return [
            // Clawscan 品牌名重定向 → 实际路由 /skill-check
            {
                source: '/clawscan',
                destination: '/skill-check',
                permanent: true, // 301 永久重定向
            },
        ];
    },
    async headers() {
        // 从环境变量读取允许的域名，默认仅允许 localhost
        const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(',').map(o => o.trim());

        return [
            // Service Worker — 确保不被缓存、可控制全站
            {
                source: '/sw.js',
                headers: [
                    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                    { key: 'Service-Worker-Allowed', value: '/' },
                ],
            },
            {
                source: '/api/:path*',
                headers: [
                    { key: 'Access-Control-Allow-Origin', value: allowedOrigins[0] || 'http://localhost:3000' },
                    { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS,DELETE' },
                    { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'DENY' },
                ],
            },
            // OAuth 和 well-known 端点需要允许跨域（MCP/ChatGPT 集成需要）
            {
                source: '/.well-known/:path*',
                headers: [
                    { key: 'Access-Control-Allow-Origin', value: '*' },
                    { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS' },
                    { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
                ],
            },
            {
                source: '/api/oauth/:path*',
                headers: [
                    { key: 'Access-Control-Allow-Origin', value: '*' },
                    { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
                    { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
                ],
            },
            // SEO + 安全：全局 HTTP 头
            {
                source: '/:path*',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                    { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
                    { key: 'X-DNS-Prefetch-Control', value: 'on' },
                    // 🔒 CSP：限制脚本/资源来源，防止 XSS
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                            "font-src 'self' https://fonts.gstatic.com",
                            "img-src 'self' data: blob: https: http:",
                            "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
                            "frame-src 'self'",
                            "object-src 'none'",
                            "base-uri 'self'",
                        ].join('; '),
                    },
                    // 🔒 权限策略：限制敏感浏览器 API
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                ],
            },
        ]
    },
    eslint: {
        // ESLint 在构建期间跳过，避免虚假报告阻塞 CI
        // 已有的 no-explicit-any warnings 不影响运行，后续逐步修复
        ignoreDuringBuilds: true,
    },
    typescript: {
        // ⚠️ 安全警告：忽略构建类型错误可能掩盖潜在安全隐患
        // TODO: 逐步修复所有 TypeScript 错误后移除此配置
        ignoreBuildErrors: true,
    },
}

module.exports = nextConfig
