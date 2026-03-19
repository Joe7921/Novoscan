'use client';

/**
 * ShareButton — 一键分享报告按钮
 *
 * 点击后将报告数据发送到后端生成公开链接，
 * 支持复制到剪贴板和社交平台分享。
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Share2, Check, Copy, Loader2, Twitter, Linkedin, Link2, QrCode, X } from 'lucide-react';
import QRCode from 'qrcode';
import { createPortal } from 'react-dom';
import ModalPortal from '@/components/ui/ModalPortal';

interface ShareButtonProps {
    /** 用户的想法描述 */
    query: string;
    /** 报告数据（用于传给后端） */
    report: unknown;
    /** 双轨结果数据 */
    dualResult?: any;
    /** 报告类型 */
    reportType?: 'novoscan' | 'bizscan' | 'clawscan' | 'flash';
    /** 按钮尺寸 */
    size?: 'sm' | 'md';
}

type ShareState = 'idle' | 'sharing' | 'success' | 'error';

export default function ShareButton({
    query,
    report,
    dualResult,
    reportType = 'novoscan',
    size = 'md',
}: ShareButtonProps) {
    const [state, setState] = useState<ShareState>('idle');
    const [shareUrl, setShareUrl] = useState<string>('');
    const [showPanel, setShowPanel] = useState(false);
    const [copied, setCopied] = useState(false);

    const [showQrModal, setShowQrModal] = useState(false);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);

    // 渲染 QR 码
    useEffect(() => {
        if (showQrModal && qrCanvasRef.current && shareUrl) {
            QRCode.toCanvas(qrCanvasRef.current, shareUrl, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#1e293b', // slate-800
                    light: '#ffffff'
                }
            }).catch(console.error);
        }
    }, [showQrModal, shareUrl]);

    const handleShare = useCallback(async () => {
        if (state === 'sharing') return;

        setState('sharing');

        try {
            // 构建摘要信息
            const overallScore = report?.noveltyScore || report?.arbitration?.overallScore || 0;
            const noveltyLevel = report?.noveltyLevel || 'Medium';
            const keyFinding = report?.summary || report?.arbitration?.summary || '';

            const response = await fetch('/api/report/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ideaSummary: query.slice(0, 200),
                    ideaFull: query,
                    reportType,
                    overallScore,
                    noveltyLevel,
                    keyFinding: keyFinding.slice(0, 500),
                    reportJson: {
                        report,
                        dualResult: dualResult ? {
                            // 精简传输数据：只保留核心字段
                            arbitration: dualResult.arbitration,
                            academicReview: dualResult.academicReview,
                            industryAnalysis: dualResult.industryAnalysis,
                            innovationEvaluation: dualResult.innovationEvaluation,
                            competitorAnalysis: dualResult.competitorAnalysis,
                            qualityCheck: dualResult.qualityCheck,
                            innovationRadar: dualResult.innovationRadar,
                            noveltyScore: dualResult.noveltyScore,
                            recommendation: dualResult.recommendation,
                            summary: dualResult.summary,
                        } : undefined,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error('分享失败');
            }

            const data = await response.json();
            setShareUrl(data.shareUrl);
            setState('success');
            setShowPanel(true);


        } catch (err) {
            console.error('[ShareButton] 分享失败:', err);
            setState('error');
            setTimeout(() => setState('idle'), 3000);
        }
    }, [query, report, dualResult, reportType, state]);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback: 使用 input 元素复制
            const input = document.createElement('input');
            input.value = shareUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [shareUrl]);

    const handleSocialShare = useCallback((platform: string) => {
        const overallScore = report?.noveltyScore || report?.arbitration?.overallScore || 0;
        let text = `我的创新想法在 Novoscan 获得了 ${overallScore} 分！`;
        
        const encodedUrl = encodeURIComponent(shareUrl);
        const encodedText = encodeURIComponent(text);

        const urls: Record<string, string> = {
            twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        };

        if (urls[platform]) {
            window.open(urls[platform], '_blank', 'width=600,height=500');
        }
    }, [shareUrl, report]);

    const isSmall = size === 'sm';

    return (
        <>
            {/* 分享按钮 */}
            <button
                onClick={handleShare}
                disabled={state === 'sharing'}
                className={`
                    inline-flex items-center gap-1.5 font-bold rounded-full
                    transition-all duration-200 relative overflow-hidden
                    ${isSmall
                        ? 'text-xs px-3 py-1.5'
                        : 'text-sm px-4 py-2'
                    }
                    ${state === 'sharing'
                        ? 'bg-gray-100 text-gray-400 cursor-wait'
                        : state === 'error'
                            ? 'bg-red-50 text-red-500 border border-red-200'
                            : 'bg-gradient-to-r from-blue-500 to-violet-500 text-white hover:shadow-lg hover:shadow-blue-500/25 hover:scale-105 active:scale-95'
                    }
                `}
            >
                {state === 'sharing' ? (
                    <>
                        <Loader2 className={`${isSmall ? 'w-3 h-3' : 'w-4 h-4'} animate-spin`} />
                        分享中...
                    </>
                ) : state === 'error' ? (
                    <>分享失败</>
                ) : (
                    <>
                        <Share2 className={`${isSmall ? 'w-3 h-3' : 'w-4 h-4'}`} />
                        分享报告
                    </>
                )}
            </button>

            {/* 分享面板 */}
            {showPanel && shareUrl && (
                <ModalPortal>
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
                        onClick={() => setShowPanel(false)}
                    >
                        <div
                            className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-[90%] mx-4 animate-in fade-in zoom-in-95 duration-200"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* 成功图标 */}
                            <div className="flex justify-center mb-4">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                                    <Check className="w-7 h-7 text-white" strokeWidth={3} />
                                </div>
                            </div>

                            <h3 className="text-xl font-black text-center text-gray-900 mb-1">
                                报告已生成分享链接 🎉
                            </h3>
                            <p className="text-sm text-gray-400 text-center mb-5">
                                任何人都可以通过此链接查看你的分析报告
                            </p>

                            {/* 链接 */}
                            <div className="flex items-center gap-2 bg-gray-50 rounded-2xl p-3 mb-5">
                                <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="text-sm text-gray-600 truncate flex-1 font-mono">
                                    {shareUrl}
                                </span>
                                <button
                                    onClick={handleCopy}
                                    className={`flex-shrink-0 p-2 rounded-xl transition-all duration-200 ${copied
                                            ? 'bg-green-100 text-green-600'
                                            : 'bg-white text-gray-500 hover:bg-blue-50 hover:text-blue-600 shadow-sm'
                                        }`}
                                >
                                    {copied ? (
                                        <Check className="w-4 h-4" />
                                    ) : (
                                        <Copy className="w-4 h-4" />
                                    )}
                                </button>
                            </div>

                            {/* 社交分享按钮 */}
                            <div className="grid grid-cols-3 gap-2 mb-5">
                                <button
                                    onClick={() => handleSocialShare('twitter')}
                                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-black text-white hover:bg-gray-800 transition-colors text-xs font-bold"
                                >
                                    <Twitter className="w-5 h-5" />
                                    Twitter
                                </button>
                                <button
                                    onClick={() => handleSocialShare('linkedin')}
                                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#0077B5] text-white hover:bg-[#005885] transition-colors text-xs font-bold"
                                >
                                    <Linkedin className="w-5 h-5" />
                                    LinkedIn
                                </button>
                                <button
                                    onClick={() => setShowQrModal(true)}
                                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#07C160] text-white hover:bg-[#06ad56] transition-colors text-xs font-bold relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
                                    <QrCode className="w-5 h-5" />
                                    微信分享
                                </button>
                            </div>

                            {/* 挑战好友 */}
                            <div className="flex items-center justify-center gap-2 mb-4 text-xs text-gray-400">
                                <span>🎯</span>
                                <span>分享给朋友，看看他们的创新想法能得多少分！</span>
                            </div>

                            {/* 关闭 */}
                            <button
                                onClick={() => setShowPanel(false)}
                                className="w-full py-2.5 rounded-2xl text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* 微信二维码弹窗 */}
            {showQrModal && shareUrl && (
                <ModalPortal>
                    <div
                        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowQrModal(false)}
                    >
                        <div
                            className="bg-white rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setShowQrModal(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            
                            <div className="p-3 bg-gray-50 rounded-2xl mb-3 border border-gray-100">
                                <canvas ref={qrCanvasRef} className="rounded-xl w-48 h-48" />
                            </div>
                            
                            <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                                <qrCode className="w-4 h-4 text-[#07C160]" />
                                微信扫一扫分享
                            </h4>
                            <p className="text-xs text-gray-400 text-center max-w-[200px]">
                                打开微信"扫一扫"，将报告分享给好友或朋友圈
                            </p>
                        </div>
                    </div>
                </ModalPortal>
            )}


        </>
    );
}
