'use client';

/**
 * PartnerFormModal — 合作伙伴申请表单弹窗
 *
 * 特性：
 *   - Framer Motion 弹窗动画
 *   - Zod 客户端实时验证
 *   - Cloudflare Turnstile 人机验证（可选）
 *   - 提交状态管理（idle / submitting / success / error）
 *   - 中英双语支持
 */

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
    interface Window {
        turnstile?: {
            render: (container: HTMLElement, options: Record<string, unknown>) => string;
            reset: (widgetId: string) => void;
        };
    }
}

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Handshake, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import {
    partnerFormSchema,
    COOPERATION_TYPES,
    COOPERATION_LABELS,
    type PartnerFormData,
    type CooperationType,
} from '@/lib/schemas/partnerSchema';

interface PartnerFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    language?: 'zh' | 'en';
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

const i18n = {
    zh: {
        title: '成为合作伙伴',
        subtitle: '填写以下信息，我们将尽快与您联系',
        companyName: '公司 / 机构名称',
        companyPlaceholder: '请输入公司名称',
        contactName: '联系人姓名',
        contactPlaceholder: '请输入您的姓名',
        email: '联系邮箱',
        emailPlaceholder: 'your@email.com',
        cooperationType: '合作类型',
        cooperationPlaceholder: '请选择合作类型',
        message: '合作描述（可选）',
        messagePlaceholder: '请简述您的合作意向或需求...',
        submit: '提交申请',
        submitting: '提交中...',
        successTitle: '申请已提交！',
        successDesc: '感谢您的合作意向，我们会在 1-3 个工作日内通过邮件与您联系。',
        errorTitle: '提交失败',
        errorDesc: '请稍后再试，或直接发送邮件至 zhouhaoyu6666@gmail.com',
        close: '关闭',
        retry: '重试',
    },
    en: {
        title: 'Become a Partner',
        subtitle: 'Fill in the form below and we\'ll get back to you soon',
        companyName: 'Company / Organization',
        companyPlaceholder: 'Enter company name',
        contactName: 'Contact Name',
        contactPlaceholder: 'Enter your name',
        email: 'Email Address',
        emailPlaceholder: 'your@email.com',
        cooperationType: 'Partnership Type',
        cooperationPlaceholder: 'Select a type',
        message: 'Description (Optional)',
        messagePlaceholder: 'Briefly describe your partnership intention...',
        submit: 'Submit Application',
        submitting: 'Submitting...',
        successTitle: 'Application Submitted!',
        successDesc: 'Thank you for your interest. We\'ll reach out within 1-3 business days.',
        errorTitle: 'Submission Failed',
        errorDesc: 'Please try again later, or email us at zhouhaoyu6666@gmail.com',
        close: 'Close',
        retry: 'Retry',
    },
};

export default function PartnerFormModal({ isOpen, onClose, language = 'zh' }: PartnerFormModalProps) {
    const t = i18n[language];
    const isZh = language === 'zh';

    const [formData, setFormData] = useState<PartnerFormData>({
        company_name: '',
        contact_name: '',
        email: '',
        cooperation_type: 'technology',
        message: '',
    });
    const [errors, setErrors] = useState<Partial<Record<keyof PartnerFormData, string>>>({});
    const [status, setStatus] = useState<SubmitStatus>('idle');
    const [serverError, setServerError] = useState('');

    // Turnstile 人机验证
    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const turnstileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen || !turnstileSiteKey || !turnstileRef.current) return;

        // 动态加载 Turnstile 脚本
        const scriptId = 'cf-turnstile-script';
        let script = document.getElementById(scriptId) as HTMLScriptElement | null;
        if (!script) {
            script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            document.head.appendChild(script);
        }

        const renderWidget = () => {
            if (!turnstileRef.current || !window.turnstile) return;
            turnstileRef.current.innerHTML = '';
            window.turnstile.render(turnstileRef.current, {
                sitekey: turnstileSiteKey,
                callback: (token: string) => setTurnstileToken(token),
                'expired-callback': () => setTurnstileToken(null),
                theme: 'light',
                size: 'flexible',
            });
        };

        if (window.turnstile) {
            renderWidget();
        } else {
            script.addEventListener('load', renderWidget);
        }

        return () => {
            script?.removeEventListener('load', renderWidget);
        };
    }, [isOpen, turnstileSiteKey]);

    const resetForm = useCallback(() => {
        setFormData({ company_name: '', contact_name: '', email: '', cooperation_type: 'technology', message: '' });
        setErrors({});
        setStatus('idle');
        setServerError('');
        setTurnstileToken(null);
    }, []);

    const handleClose = useCallback(() => {
        if (status === 'submitting') return; // 提交中禁止关闭
        onClose();
        // 延迟重置，让动画完成
        setTimeout(resetForm, 300);
    }, [status, onClose, resetForm]);

    const handleChange = (field: keyof PartnerFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // 清除该字段的错误
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 客户端 Zod 验证
        const result = partnerFormSchema.safeParse(formData);
        if (!result.success) {
            const fieldErrors: Partial<Record<keyof PartnerFormData, string>> = {};
            result.error.issues.forEach(err => {
                const field = err.path[0] as keyof PartnerFormData;
                if (!fieldErrors[field]) fieldErrors[field] = err.message;
            });
            setErrors(fieldErrors);
            return;
        }

        setStatus('submitting');
        setServerError('');

        try {
            const payload: Record<string, unknown> = { ...result.data };
            if (turnstileToken) payload.turnstile_token = turnstileToken;

            const res = await fetch('/api/partner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            if (res.ok && json.success) {
                setStatus('success');
            } else {
                setStatus('error');
                setServerError(json.error || (isZh ? '提交失败' : 'Submission failed'));
            }
        } catch {
            setStatus('error');
            setServerError(isZh ? '网络错误，请检查网络连接' : 'Network error, please check your connection');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* 遮罩 */}
                    <motion.div
                        className="absolute inset-0 bg-black/40"
                        onClick={handleClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* 弹窗主体 */}
                    <motion.div
                        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 头部 */}
                        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
                            <button
                                onClick={handleClose}
                                className="absolute top-4 right-4 p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                                aria-label={t.close}
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/15 rounded-xl">
                                    <Handshake className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">{t.title}</h2>
                                    <p className="text-sm text-blue-100/80">{t.subtitle}</p>
                                </div>
                            </div>
                        </div>

                        {/* 内容区 */}
                        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">
                            <AnimatePresence mode="wait">
                                {status === 'success' ? (
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="flex flex-col items-center py-8 text-center"
                                    >
                                        <div className="p-3 bg-green-50 rounded-full mb-4">
                                            <CheckCircle className="w-10 h-10 text-green-500" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t.successTitle}</h3>
                                        <p className="text-sm text-gray-500 mb-6 max-w-xs">{t.successDesc}</p>
                                        <button
                                            onClick={handleClose}
                                            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors"
                                        >
                                            {t.close}
                                        </button>
                                    </motion.div>
                                ) : status === 'error' ? (
                                    <motion.div
                                        key="error"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="flex flex-col items-center py-8 text-center"
                                    >
                                        <div className="p-3 bg-red-50 rounded-full mb-4">
                                            <AlertCircle className="w-10 h-10 text-red-500" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t.errorTitle}</h3>
                                        <p className="text-sm text-gray-500 mb-1">{serverError}</p>
                                        <p className="text-xs text-gray-400 mb-6">{t.errorDesc}</p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setStatus('idle')}
                                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors"
                                            >
                                                {t.retry}
                                            </button>
                                            <button
                                                onClick={handleClose}
                                                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors"
                                            >
                                                {t.close}
                                            </button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.form
                                        key="form"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onSubmit={handleSubmit}
                                        className="space-y-4"
                                    >
                                        {/* 公司名称 */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                {t.companyName} <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.company_name}
                                                onChange={e => handleChange('company_name', e.target.value)}
                                                placeholder={t.companyPlaceholder}
                                                className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors outline-none
                                                    ${errors.company_name
                                                        ? 'border-red-300 focus:border-red-400 bg-red-50/30'
                                                        : 'border-gray-200 focus:border-blue-400 bg-gray-50/50 focus:bg-white'
                                                    }`}
                                            />
                                            {errors.company_name && (
                                                <p className="text-xs text-red-500 mt-1">{errors.company_name}</p>
                                            )}
                                        </div>

                                        {/* 联系人 */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                {t.contactName} <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.contact_name}
                                                onChange={e => handleChange('contact_name', e.target.value)}
                                                placeholder={t.contactPlaceholder}
                                                className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors outline-none
                                                    ${errors.contact_name
                                                        ? 'border-red-300 focus:border-red-400 bg-red-50/30'
                                                        : 'border-gray-200 focus:border-blue-400 bg-gray-50/50 focus:bg-white'
                                                    }`}
                                            />
                                            {errors.contact_name && (
                                                <p className="text-xs text-red-500 mt-1">{errors.contact_name}</p>
                                            )}
                                        </div>

                                        {/* 邮箱 */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                {t.email} <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={e => handleChange('email', e.target.value)}
                                                placeholder={t.emailPlaceholder}
                                                className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors outline-none
                                                    ${errors.email
                                                        ? 'border-red-300 focus:border-red-400 bg-red-50/30'
                                                        : 'border-gray-200 focus:border-blue-400 bg-gray-50/50 focus:bg-white'
                                                    }`}
                                            />
                                            {errors.email && (
                                                <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                                            )}
                                        </div>

                                        {/* 合作类型 */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                {t.cooperationType} <span className="text-red-400">*</span>
                                            </label>
                                            <select
                                                value={formData.cooperation_type}
                                                onChange={e => handleChange('cooperation_type', e.target.value)}
                                                className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors outline-none appearance-none cursor-pointer
                                                    ${errors.cooperation_type
                                                        ? 'border-red-300 focus:border-red-400 bg-red-50/30'
                                                        : 'border-gray-200 focus:border-blue-400 bg-gray-50/50 focus:bg-white'
                                                    }`}
                                            >
                                                {COOPERATION_TYPES.map(type => (
                                                    <option key={type} value={type}>
                                                        {COOPERATION_LABELS[type][isZh ? 'zh' : 'en']}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors.cooperation_type && (
                                                <p className="text-xs text-red-500 mt-1">{errors.cooperation_type}</p>
                                            )}
                                        </div>

                                        {/* 合作描述 */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                {t.message}
                                            </label>
                                            <textarea
                                                value={formData.message}
                                                onChange={e => handleChange('message', e.target.value)}
                                                placeholder={t.messagePlaceholder}
                                                rows={3}
                                                className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors outline-none resize-none
                                                    ${errors.message
                                                        ? 'border-red-300 focus:border-red-400 bg-red-50/30'
                                                        : 'border-gray-200 focus:border-blue-400 bg-gray-50/50 focus:bg-white'
                                                    }`}
                                            />
                                            <div className="flex justify-between mt-1">
                                                {errors.message && (
                                                    <p className="text-xs text-red-500">{errors.message}</p>
                                                )}
                                                <p className="text-xs text-gray-300 ml-auto">
                                                    {(formData.message || '').length}/500
                                                </p>
                                            </div>
                                        </div>

                                        {/* Turnstile 人机验证（配置了 NEXT_PUBLIC_TURNSTILE_SITE_KEY 时显示） */}
                                        {turnstileSiteKey && (
                                            <div className="flex justify-center">
                                                <div ref={turnstileRef} />
                                            </div>
                                        )}

                                        {/* 提交按钮 */}
                                        <button
                                            type="submit"
                                            disabled={status === 'submitting'}
                                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-sm
                                                hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25
                                                disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {status === 'submitting' ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    {t.submitting}
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-4 h-4" />
                                                    {t.submit}
                                                </>
                                            )}
                                        </button>
                                    </motion.form>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
