'use client';

/**
 * SiteFooter — 全站 SEO 底部导航
 *
 * 提供结构化的内部链接，增强 SEO 内链权重；
 * 同时提供品牌信息和社交媒体入口。
 * 集成合作伙伴申请表单入口。
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Mail, Handshake, ArrowRight } from 'lucide-react';
import PartnerFormModal from '@/components/partner/PartnerFormModal';

interface SiteFooterProps {
    language?: 'zh' | 'en';
}

export default function SiteFooter({ language = 'zh' }: SiteFooterProps) {
    const isZh = language === 'zh';
    const [showPartnerForm, setShowPartnerForm] = useState(false);

    const sections = [
        {
            title: isZh ? '产品' : 'Products',
            links: [
                { label: 'Novoscan', href: '/', desc: isZh ? 'AI 创新深度分析' : 'AI Innovation Analysis' },
                { label: 'Bizscan', href: '/bizscan', desc: isZh ? 'AI 商业可行性' : 'Business Feasibility' },
                { label: 'Clawscan', href: '/skill-check', desc: isZh ? 'AI 创新查重' : 'Innovation Check' },
                { label: 'NovoTracker', href: '/tracker', desc: isZh ? '趋势监控' : 'Trend Monitor' },
                { label: 'Business', href: '/business', desc: isZh ? '企业版引擎' : 'Enterprise Engine' },
            ],
        },
        {
            title: isZh ? '发现' : 'Discover',
            links: [
                { label: isZh ? '创新趋势' : 'Trends', href: '/trends', desc: isZh ? '全球最新创新动态' : 'Global Trends' },
                { label: 'CaseVault', href: '/casevault', desc: isZh ? '行业应用图谱' : 'Industry Graph' },
                { label: isZh ? '使用文档' : 'Docs', href: '/docs', desc: isZh ? '产品使用指南' : 'User Guide' },
                { label: isZh ? '搜索历史' : 'History', href: '/history', desc: isZh ? '我的分析记录' : 'My Records' },
            ],
        },
        {
            title: isZh ? '关于' : 'About',
            links: [
                { label: isZh ? 'MCP 服务' : 'MCP Service', href: '/docs', desc: isZh ? '开发者 API' : 'Developer API' },
            ],
        },
    ];

    return (
        <>
            <footer className="relative z-10 border-t border-gray-100/80 dark:border-[#1E293B]/80 bg-white dark:bg-dark-base mt-16">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
                        {/* 品牌列 */}
                        <div className="col-span-2 sm:col-span-1">
                            <Link href="/" className="inline-flex items-center gap-2 group mb-4">
                                <Sparkles className="w-5 h-5 text-blue-500 dark:text-blue-400 group-hover:rotate-12 transition-transform" />
                                <span className="font-black text-lg tracking-tight">
                                    <span className="text-blue-500 dark:text-blue-400">Novo</span>
                                    <span className="text-gray-900 dark:text-slate-100">scan</span>
                                </span>
                            </Link>
                            <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed mb-4 max-w-[200px]">
                                {isZh
                                    ? 'AI 多智能体协作的创新分析平台，数十秒生成深度报告'
                                    : 'AI multi-agent innovation analysis platform'}
                            </p>
                            <div className="flex items-center gap-3">
                                <a
                                    href="mailto:zhouhaoyu6666@gmail.com"
                                    className="p-2 rounded-xl text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-50 dark:hover:bg-dark-elevated transition-colors"
                                    aria-label={isZh ? '发送邮件' : 'Send email'}
                                >
                                    <Mail className="w-4 h-4" />
                                </a>
                            </div>
                        </div>

                        {/* 导航列 */}
                        {sections.map((section) => (
                            <div key={section.title}>
                                <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200 uppercase tracking-wider mb-4">
                                    {section.title}
                                </h4>
                                <ul className="space-y-2.5">
                                    {section.links.map(link => (
                                        <li key={link.href + link.label}>
                                            <Link
                                                href={link.href}
                                                className="group block"
                                            >
                                                <span className="text-sm text-gray-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors font-medium">
                                                    {link.label}
                                                </span>
                                                <span className="block text-[10px] text-gray-300 dark:text-slate-600 group-hover:text-gray-400 dark:group-hover:text-slate-500 transition-colors">
                                                    {link.desc}
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                    {/* 在"关于"栏追加合作伙伴入口 */}
                                    {section.title === (isZh ? '关于' : 'About') && (
                                        <li>
                                            <button
                                                onClick={() => setShowPartnerForm(true)}
                                                className="group block text-left"
                                            >
                                                <span className="text-sm text-gray-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors font-medium">
                                                    {isZh ? '成为合作伙伴' : 'Become a Partner'}
                                                </span>
                                                <span className="block text-[10px] text-gray-300 dark:text-slate-600 group-hover:text-gray-400 dark:group-hover:text-slate-500 transition-colors">
                                                    {isZh ? '商务合作申请' : 'Partnership Application'}
                                                </span>
                                            </button>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* 合作伙伴 CTA 横幅 */}
                    <div className="mt-10 pt-6 border-t border-gray-100/60 dark:border-[#1E293B]/60">
                        <button
                            onClick={() => setShowPartnerForm(true)}
                            className="w-full group flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                                bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10
                                hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-500/20 dark:hover:to-indigo-500/20
                                border border-blue-100/80 dark:border-blue-500/20 transition-all duration-200"
                        >
                            <Handshake className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                {isZh ? '成为 Novoscan 合作伙伴' : 'Become a Novoscan Partner'}
                            </span>
                            <ArrowRight className="w-4 h-4 text-blue-400 dark:text-blue-500 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>

                    {/* 底部版权 */}
                    <div className="mt-6 pt-6 border-t border-gray-100/60 dark:border-[#1E293B]/60 flex flex-col sm:flex-row items-center justify-between gap-2">
                        <p className="text-[11px] text-gray-400 dark:text-slate-500">
                            © {new Date().getFullYear()} Novoscan. {isZh ? '创新，从分析开始。' : 'Innovation starts with analysis.'}
                        </p>
                        <p className="text-[11px] text-gray-300 dark:text-slate-600">
                            Powered by AI Multi-Agent Orchestration
                        </p>
                    </div>
                </div>
            </footer>

            {/* 合作伙伴申请表单弹窗 */}
            <PartnerFormModal
                isOpen={showPartnerForm}
                onClose={() => setShowPartnerForm(false)}
                language={language}
            />
        </>
    );
}
