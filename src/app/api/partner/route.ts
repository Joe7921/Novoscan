/**
 * POST /api/partner — 合作伙伴申请提交
 *
 * 流程：限流 → Turnstile 验证 → Zod 验证 → Supabase 入库 → Resend 邮件通知
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase';
import { partnerFormSchema, COOPERATION_LABELS, type CooperationType } from '@/lib/schemas/partnerSchema';
import { checkRateLimit, safeErrorResponse } from '@/lib/security/apiSecurity';

export async function POST(request: Request) {
    // 1. 限流：每 IP 每小时最多 5 次提交
    const rateLimited = await checkRateLimit(request, 'partner', 5, 3600_000);
    if (rateLimited) return rateLimited;

    try {
        const body = await request.json();

        // 2. Turnstile 人机验证（配置了 TURNSTILE_SECRET_KEY 时启用）
        const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
        if (turnstileSecret) {
            const turnstileToken = body.turnstile_token;
            if (!turnstileToken) {
                return NextResponse.json(
                    { success: false, error: '请完成人机验证' },
                    { status: 400 }
                );
            }
            try {
                const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ secret: turnstileSecret, response: turnstileToken }),
                });
                const verifyData = await verifyRes.json();
                if (!verifyData.success) {
                    console.warn('[Partner] Turnstile 验证失败:', verifyData);
                    return NextResponse.json(
                        { success: false, error: '人机验证失败，请刷新后重试' },
                        { status: 403 }
                    );
                }
            } catch (turnstileErr) {
                console.warn('[Partner] Turnstile 验证请求异常，放行:', turnstileErr);
                // Turnstile 服务异常时放行，不阻断表单提交
            }
        }

        // 3. Zod 服务端验证
        const parsed = partnerFormSchema.safeParse(body);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0];
            return NextResponse.json(
                { success: false, error: firstError?.message || '输入数据无效' },
                { status: 400 }
            );
        }

        const data = parsed.data;

        // 3. Supabase 入库
        const { error: dbError } = await supabaseAdmin
            .from('partner_applications')
            .insert({
                company_name: data.company_name,
                contact_name: data.contact_name,
                email: data.email,
                cooperation_type: data.cooperation_type,
                message: data.message || null,
                status: 'pending',
            });

        if (dbError) {
            console.error('[Partner] 数据库写入失败:', dbError.message);
            return safeErrorResponse(dbError, '提交失败，请稍后再试', 500, '[Partner]');
        }

        // 4. Resend 邮件通知
        const apiKey = process.env.RESEND_API_KEY;
        if (apiKey) {
            try {
                const resend = new Resend(apiKey);
                const typeLabel = COOPERATION_LABELS[data.cooperation_type as CooperationType]?.zh || data.cooperation_type;

                await resend.emails.send({
                    from: 'Novoscan Partner <onboarding@resend.dev>',
                    to: 'zhouhaoyu6666@gmail.com',
                    subject: `🤝 新合作伙伴申请 — ${data.company_name}`,
                    html: buildNotificationEmail(data, typeLabel),
                });
                console.log('[Partner] ✅ 通知邮件已发送');
            } catch (emailErr) {
                // 邮件失败不影响提交成功
                console.warn('[Partner] 邮件通知发送失败:', emailErr);
            }
        } else {
            console.warn('[Partner] RESEND_API_KEY 未配置，跳过邮件通知');
        }

        return NextResponse.json({ success: true, message: '申请已提交' });
    } catch (err) {
        return safeErrorResponse(err, '提交失败，请稍后再试', 500, '[Partner]');
    }
}

/** 构建通知邮件 HTML */
function buildNotificationEmail(
    data: { company_name: string; contact_name: string; email: string; cooperation_type: string; message?: string },
    typeLabel: string,
): string {
    return `
    <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
        <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px;border-radius:16px 16px 0 0">
            <h1 style="color:#fff;margin:0;font-size:22px">🤝 新合作伙伴申请</h1>
            <p style="color:#94a3b8;margin:8px 0 0;font-size:14px">来自 ${data.company_name}</p>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:24px">
            <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155">
                <tr>
                    <td style="padding:10px 0;font-weight:bold;width:100px;vertical-align:top">公司名称</td>
                    <td style="padding:10px 0">${data.company_name}</td>
                </tr>
                <tr style="border-top:1px solid #f1f5f9">
                    <td style="padding:10px 0;font-weight:bold;vertical-align:top">联系人</td>
                    <td style="padding:10px 0">${data.contact_name}</td>
                </tr>
                <tr style="border-top:1px solid #f1f5f9">
                    <td style="padding:10px 0;font-weight:bold;vertical-align:top">邮箱</td>
                    <td style="padding:10px 0">
                        <a href="mailto:${data.email}" style="color:#3b82f6;text-decoration:none">${data.email}</a>
                    </td>
                </tr>
                <tr style="border-top:1px solid #f1f5f9">
                    <td style="padding:10px 0;font-weight:bold;vertical-align:top">合作类型</td>
                    <td style="padding:10px 0">
                        <span style="display:inline-block;padding:4px 12px;background:#eff6ff;color:#2563eb;border-radius:12px;font-size:12px;font-weight:600">
                            ${typeLabel}
                        </span>
                    </td>
                </tr>
                ${data.message ? `
                <tr style="border-top:1px solid #f1f5f9">
                    <td style="padding:10px 0;font-weight:bold;vertical-align:top">合作描述</td>
                    <td style="padding:10px 0;line-height:1.6">${data.message}</td>
                </tr>` : ''}
            </table>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px">
            此邮件由 Novoscan 合作伙伴申请系统自动发送
        </p>
    </div>`;
}
