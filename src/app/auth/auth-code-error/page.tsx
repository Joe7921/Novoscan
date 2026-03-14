'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

/**
 * OAuth 认证失败页面。
 * 当用户 Google 登录授权码交换失败时，会被重定向到此页面。
 */
export default function AuthCodeErrorPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white/95 rounded-2xl shadow-xl border border-gray-200 p-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">登录失败</h1>
                <p className="text-gray-600 mb-6">
                    在处理您的 Google 登录请求时出现错误。请检查您的网络连接或稍后重试。
                </p>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-full font-bold hover:bg-google-blue transition-all duration-300"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回首页
                </Link>
            </div>
        </div>
    );
}
