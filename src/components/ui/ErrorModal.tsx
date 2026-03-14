/* eslint-disable @next/next/no-assign-module-variable */
import React, { useState } from 'react';
import { AlertCircle, X, Lightbulb, RefreshCw, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ModalPortal from '@/components/ui/ModalPortal';
import Link from 'next/link';

export interface ErrorInfo {
    code: string;
    title: string;
    message: string;
    suggestion: string;
    model?: string;
    timestamp?: string;
    /** #27 技术详情（折叠显示，用户无需关注） */
    details?: string;
    /** 是否为余额不足错误 */
    isBalanceError?: boolean;
}

interface ErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    errorInfo: ErrorInfo | null;
    onRetry?: () => void;
}



const ErrorModal: React.FC<ErrorModalProps> = ({ isOpen, onClose, errorInfo, onRetry }) => {
    const [showDetails, setShowDetails] = useState(false);
    // 简单检测是否为中文用户
    const isZh = typeof errorInfo?.title === 'string' && /[一-龥]/.test(errorInfo.title);
    return (
        <ModalPortal>
            <AnimatePresence>
                {isOpen && errorInfo && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/20 flex items-center justify-center p-4"
                        style={{ zIndex: 9999 }}
                        onClick={onClose}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
                            className="bg-white/95 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-red-500/10 border border-white/60 ring-1 ring-red-50/50 relative max-h-[85vh] overflow-y-auto scrollbar-hide flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* 头部 */}
                            <div className="flex items-start gap-3 mb-5">
                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                    <AlertCircle className="text-red-500" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-slate-800">{errorInfo.title}</h3>
                                    <span className="inline-block mt-1 px-2 py-0.5 bg-red-50 text-red-600 text-xs font-mono rounded">
                                        {errorInfo.code}
                                    </span>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                                >
                                    <X />
                                </button>
                            </div>

                            {/* 错误描述 */}
                            <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 mb-4">
                                <p className="text-sm text-slate-700 leading-relaxed">{errorInfo.message}</p>
                            </div>

                            {/* 建议 */}
                            <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 mb-5">
                                <h4 className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1">
                                    <Lightbulb className="text-sm" />
                                    {isZh ? '建议' : 'Suggestion'}
                                </h4>
                                <p className="text-sm text-slate-600 leading-relaxed">{errorInfo.suggestion}</p>
                            </div>

                            {/* #27 技术详情折叠 */}
                            {(errorInfo.details || errorInfo.timestamp) && (
                                <div className="mb-4">
                                    <button
                                        onClick={() => setShowDetails(!showDetails)}
                                        className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                        <span className={`transform transition-transform ${showDetails ? 'rotate-90' : ''}`}>▸</span>
                                        {isZh ? '查看技术详情' : 'View technical details'}
                                    </button>
                                    {showDetails && (
                                        <div className="mt-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs font-mono text-slate-500 max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                                            {errorInfo.timestamp && <p>Time: {errorInfo.timestamp}</p>}
                                            {errorInfo.code && <p>Code: {errorInfo.code}</p>}
                                            {errorInfo.model && <p>Model: {errorInfo.model}</p>}
                                            {errorInfo.details && <p className="mt-1">{errorInfo.details}</p>}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 余额不足 → 签到 + 订阅 引导 */}
                            {errorInfo.isBalanceError && (
                                <div className="flex flex-col gap-2 mb-3">
                                    <Link
                                        href="/novocredit"
                                        onClick={onClose}
                                        className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-bold text-sm transition-all duration-300 shadow-sm hover:shadow-lg"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        {isZh ? '📅 签到领积分 / 查看订阅' : 'Check-in / Subscribe'}
                                    </Link>
                                </div>
                            )}

                            {/* 底部按钮 */}
                            <div className="flex gap-3">
                                {onRetry && (
                                    <button
                                        onClick={() => { onClose(); onRetry(); }}
                                        className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <RefreshCw className="text-sm" />
                                        {isZh ? '重试' : 'Retry'}
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    className={`${onRetry ? 'flex-1' : 'w-full'} py-2.5 border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors`}
                                >
                                    {isZh ? '关闭' : 'Close'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </ModalPortal>
    );
};

/**
 * 从原始错误对象解析出结构化的 ErrorInfo
 */
export function parseError(err: unknown, model: string, language: 'zh' | 'en'): ErrorInfo {
    const isZh = language === 'zh';
    const timestamp = new Date().toLocaleString(isZh ? 'zh-CN' : 'en-US');
    const errMsg = err?.message || String(err);

    // 网络错误
    if (errMsg.includes('Failed to fetch') || errMsg.includes('ERR_CONNECTION')) {
        return {
            code: 'ERR_NETWORK',
            title: isZh ? '网络连接失败' : 'Network Error',
            message: isZh
                ? `无法连接到 ${model} 服务器。请求在传输过程中被中断。`
                : `Could not connect to ${model} server. The request was interrupted.`,
            suggestion: isZh
                ? '请检查网络连接和 VPN/代理设置，或稍后再试。也可以切换到其他模型。'
                : 'Check your network/VPN settings, or try again later. You can also switch models.',
            model,
            timestamp,
        };
    }

    // 超时
    if (errMsg.includes('timeout') || errMsg.includes('Timeout')) {
        return {
            code: 'ERR_TIMEOUT',
            title: isZh ? '请求超时' : 'Request Timeout',
            message: isZh
                ? `${model} 服务器响应时间过长，可能正在高负载运行。`
                : `${model} server took too long to respond. It might be under heavy load.`,
            suggestion: isZh
                ? '建议等一两分钟后重试，或切换到其他模型。'
                : 'Wait a minute and retry, or switch to another model.',
            model,
            timestamp,
        };
    }

    // 401/403
    if (errMsg.includes('401') || errMsg.includes('Unauthorized') || errMsg.includes('403')) {
        return {
            code: 'ERR_AUTH',
            title: isZh ? 'API 密钥无效' : 'Invalid API Key',
            message: isZh
                ? `${model} API 密钥验证失败，可能已过期或格式不正确。`
                : `${model} API key validation failed. It may be expired or invalid.`,
            suggestion: isZh
                ? '请到 .env 文件中检查并更新对应的 API 密钥。'
                : 'Check and update the API key in your .env file.',
            model,
            timestamp,
        };
    }

    // 429 限流
    if (errMsg.includes('429') || errMsg.includes('rate limit') || errMsg.includes('Too Many')) {
        return {
            code: 'ERR_RATE_LIMIT',
            title: isZh ? '请求频率限制' : 'Rate Limited',
            message: isZh
                ? `${model} API 调用频率超出限制。`
                : `${model} API rate limit exceeded.`,
            suggestion: isZh
                ? '请等待 30 秒后再试，或切换到其他模型。'
                : 'Wait 30 seconds and try again, or switch models.',
            model,
            timestamp,
        };
    }

    // 500 服务端错误
    if (errMsg.includes('500') || errMsg.includes('Internal Server')) {
        return {
            code: 'ERR_SERVER',
            title: isZh ? '服务器内部错误' : 'Server Error',
            message: isZh
                ? `${model} 服务器发生内部错误，这通常是暂时性问题。`
                : `${model} server encountered an internal error. This is usually temporary.`,
            suggestion: isZh
                ? '请稍后重试，或切换到其他模型。'
                : 'Retry later or switch models.',
            model,
            timestamp,
        };
    }

    // 余额不足 / 配额用完
    if (errMsg.includes('余额不足') || errMsg.includes('积分不足') || errMsg.includes('配额') || errMsg.includes('insufficient') || errMsg.includes('balance')) {
        return {
            code: 'ERR_BALANCE',
            title: isZh ? '额度不足' : 'Insufficient Credits',
            message: isZh
                ? errMsg
                : `Insufficient credits to perform this action.`,
            suggestion: isZh
                ? '💡 每日签到可领 10-30 积分（够 1 次搜索），或订阅 Starter Plan 获取月度免费配额'
                : 'Daily check-in earns 10-30 credits, or subscribe for monthly quota.',
            model,
            timestamp,
            isBalanceError: true,
        };
    }

    // 默认未知错误
    return {
        code: 'ERR_UNKNOWN',
        title: isZh ? '分析失败' : 'Analysis Failed',
        message: isZh
            ? `使用 ${model} 分析时发生未知错误：${errMsg}`
            : `Unknown error while analyzing with ${model}: ${errMsg}`,
        suggestion: isZh
            ? '请检查控制台获取详细信息，或切换模型重试。'
            : 'Check the console for details, or switch models and retry.',
        model,
        timestamp,
    };
}

export default ErrorModal;
