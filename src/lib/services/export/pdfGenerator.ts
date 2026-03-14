/**
 * 前端 PDF 报告生成器 — 科研论文风格
 *
 * 使用浏览器原生 window.print() 通过隐藏 iframe 生成 PDF。
 * 零依赖，支持中英文，学术论文级排版。
 */
import type { ProfessionalReport } from '@/server/report/reportWriter';

/**
 * 将 Markdown 基础语法转为 HTML
 */
function markdownToHtml(md: string): string {
    if (!md) return '';
    return md
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^[-•]\s+(.*)/gm, '<li>$1</li>')
        .replace(/^\d+\.\s+(.*)/gm, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>')
        .replace(/(<li>[\s\S]*?<\/li>)/g, (match) => `<ul>${match}</ul>`)
        .replace(/<\/ul>\s*<ul>/g, '');
}

function getScoreColor(score: number): string {
    if (score >= 80) return '#059669';
    if (score >= 60) return '#d97706';
    return '#dc2626';
}

function getCredibilityLabel(level: string, isZh: boolean): string {
    const map: Record<string, { zh: string; en: string }> = {
        high: { zh: '高可信度', en: 'High' },
        medium: { zh: '中等可信度', en: 'Medium' },
        low: { zh: '低可信度', en: 'Low' },
    };
    return isZh ? (map[level]?.zh || level) : (map[level]?.en || level);
}

/**
 * 构建科研论文风格的报告 HTML
 */
function buildReportHtml(report: ProfessionalReport): string {
    const isZh = report.language === 'zh';
    const date = new Date(report.generatedAt).toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    });

    const sectionsHtml = report.sections.map((section, idx) => `
        <div class="section">
            <h2><span class="section-num">${idx + 1}</span>${section.title}</h2>
            ${section.keyFinding ? `
            <div class="key-finding">
                <span class="kf-label">${isZh ? '核心发现' : 'Key Finding'}</span>
                <span class="kf-text">${section.keyFinding}</span>
            </div>
            ` : ''}
            <div class="section-content">
                <p>${markdownToHtml(section.content)}</p>
            </div>
        </div>
    `).join('');

    const keyFindingsHtml = (report.keyFindings || []).map((kf, idx) => `
        <li><span class="kf-num">${idx + 1}</span>${kf}</li>
    `).join('');

    const nextStepsHtml = report.nextSteps.map((step, idx) => `
        <li><span class="step-priority">${isZh ? '优先级' : 'P'}${idx + 1}</span>${step}</li>
    `).join('');

    // ================= 新增数据区块 HTML =================

    // 1. 数据覆盖概览
    let dataProfileHtml = '';
    if (report.dataProfile) {
        const dp = report.dataProfile;
        dataProfileHtml = `
        <div class="data-profile">
            <h3>${isZh ? '📊 数据底层画像' : '📊 Data Profile'}</h3>
            <div class="dp-grid">
                <div class="dp-box">
                    <div class="dp-val">${dp.totalPapers || 0}</div>
                    <div class="dp-lbl">${isZh ? '关联文献' : 'Papers'}</div>
                </div>
                <div class="dp-box">
                    <div class="dp-val">${dp.totalCitations || 0}</div>
                    <div class="dp-lbl">${isZh ? '累计被引' : 'Citations'}</div>
                </div>
                <div class="dp-box">
                    <div class="dp-val" style="color:#059669">${dp.openAccessCount || 0}</div>
                    <div class="dp-lbl">${isZh ? '开放获取' : 'Open Access'}</div>
                </div>
                <div class="dp-box">
                    <div class="dp-val">${dp.webResultsCount || 0}</div>
                    <div class="dp-lbl">${isZh ? '全网资讯' : 'Web Results'}</div>
                </div>
                <div class="dp-box">
                    <div class="dp-val">${dp.githubReposCount || 0}</div>
                    <div class="dp-lbl">${isZh ? '开源项目' : 'OS Projects'}</div>
                </div>
                <div class="dp-box">
                    <div class="dp-val" style="color:#d97706">${dp.totalStars ? (dp.totalStars >= 1000 ? (dp.totalStars / 1000).toFixed(1) + 'k' : dp.totalStars) : 0}</div>
                    <div class="dp-lbl">${isZh ? '生态星标' : 'OSS Stars'}</div>
                </div>
            </div>
        </div>`;
    }

    // 2. 加权评分明细
    let scoreBreakdownHtml = '';
    if (report.weightedScoreBreakdown) {
        const wb = report.weightedScoreBreakdown;
        scoreBreakdownHtml = `
        <div class="score-breakdown">
            <table class="sb-table">
                <thead>
                    <tr>
                        <th style="text-align:left">${isZh ? '多维评测指标' : 'Dimension'}</th>
                        <th>${isZh ? '原始分' : 'Raw'}</th>
                        <th>${isZh ? '权重' : 'Weight'}</th>
                        <th>${isZh ? '加权贡献' : 'Weighted'}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="font-weight:600; color:#312e81;">学术研究潜力 (Academic)</td>
                        <td>${wb.academic?.raw || 0}</td>
                        <td>${Math.round((wb.academic?.weight || 0) * 100)}%</td>
                        <td style="font-weight:700; color:#4f46e5;">+${wb.academic?.weighted?.toFixed(1) || 0}</td>
                    </tr>
                    <tr>
                        <td style="font-weight:600; color:#9a3412;">产业落地前景 (Industry)</td>
                        <td>${wb.industry?.raw || 0}</td>
                        <td>${Math.round((wb.industry?.weight || 0) * 100)}%</td>
                        <td style="font-weight:700; color:#ea580c;">+${wb.industry?.weighted?.toFixed(1) || 0}</td>
                    </tr>
                    <tr>
                        <td style="font-weight:600; color:#065f46;">核心技术突破 (Innovation)</td>
                        <td>${wb.innovation?.raw || 0}</td>
                        <td>${Math.round((wb.innovation?.weight || 0) * 100)}%</td>
                        <td style="font-weight:700; color:#059669;">+${wb.innovation?.weighted?.toFixed(1) || 0}</td>
                    </tr>
                    <tr>
                        <td style="font-weight:600; color:#86198f;">生态与护城河 (Moat)</td>
                        <td>${wb.competitor?.raw || 0}</td>
                        <td>${Math.round((wb.competitor?.weight || 0) * 100)}%</td>
                        <td style="font-weight:700; color:#c026d3;">+${wb.competitor?.weighted?.toFixed(1) || 0}</td>
                    </tr>
                </tbody>
            </table>
        </div>`;
    }

    // 3. 相似度对标论文
    let similarPapersHtml = '';
    if (report.topSimilarPapers && report.topSimilarPapers.length > 0) {
        similarPapersHtml = `
        <div class="similar-papers">
            <h2>${isZh ? '📚 关键对比文献' : '📚 Key Benchmark Papers'}</h2>
            <div class="sp-list">
                ${report.topSimilarPapers.map(p => `
                <div class="sp-item">
                    <div class="sp-header">
                        <span class="sp-title">${p.title}</span>
                        <span class="sp-year">${p.year || ''}</span>
                    </div>
                    <div class="sp-meta">
                        ${p.venue ? `<span class="sp-tag venue">${p.venue}</span>` : ''}
                        ${p.citationCount ? `<span class="sp-tag cite">${isZh ? '引用:' : 'Cited:'} ${p.citationCount}</span>` : ''}
                        <span class="sp-tag sim">${isZh ? '相似度:' : 'Similarity:'} <strong style="color:#dc2626">${p.similarityScore}%</strong></span>
                    </div>
                    <div class="sp-diff"><strong>${isZh ? '演进差异: ' : 'Difference: '}</strong>${p.keyDifference}</div>
                </div>
                `).join('')}
            </div>
        </div>`;
    }

    // 4. 质量审计与共识
    let auditHtml = '';
    if (report.qualityAudit || report.expertConsensus) {
        auditHtml = `
        <div class="audit-bar">
            ${report.qualityAudit ? `
            <div class="audit-badge ${report.qualityAudit.passed ? 'passed' : 'warn'}">
                ${report.qualityAudit.passed ? '✓ AI 逻辑级审计通过' : '⚠️ 存在逻辑风险预警'}
                <span class="audit-score">(一致性 ${report.qualityAudit.consistencyScore}/100)</span>
            </div>` : ''}
            
            ${report.expertConsensus ? `
            <div class="audit-badge consensus">
                多源专家共识度: <strong>${report.expertConsensus.consensusLevel}</strong>
            </div>` : ''}
        </div>
        `;
    }

    return `<!DOCTYPE html>
<html lang="${isZh ? 'zh-CN' : 'en'}">
<head>
    <meta charset="UTF-8">
    <title>${report.title}</title>
    <style>
        @page {
            size: A4;
            margin: 22mm 20mm 20mm 20mm;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Georgia', 'Noto Serif SC', 'Source Han Serif CN', 'Songti SC', 'SimSun', serif;
            color: #1a1a2e;
            line-height: 1.8;
            font-size: 10.5pt;
            background: linear-gradient(155deg, #fce4ec 0%, #f3e5f5 12%, #e8eaf6 30%, #e1f5fe 50%, #e0f7fa 70%, #f1f8e9 100%);
            background-attachment: fixed;
            position: relative;
        }

        body::before {
            content: '';
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background-image: radial-gradient(circle, rgba(0,0,0,0.025) 1px, transparent 1px);
            background-size: 16px 16px;
            pointer-events: none;
            z-index: 0;
        }

        .page-wrapper {
            max-width: 680px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
        }

        /* ==================== 封面区 ==================== */
        .cover {
            text-align: center;
            padding: 36px 0 28px;
            margin-bottom: 0;
        }

        .cover .brand {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
            font-size: 11pt;
            font-weight: 700;
            color: #6366f1;
            letter-spacing: 4px;
            text-transform: uppercase;
            margin-bottom: 24px;
        }

        .cover .brand-logo {
            width: 22px;
            height: 22px;
        }

        .cover h1 {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            font-size: 20pt;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 6px;
            line-height: 1.35;
        }

        .cover .subtitle {
            font-family: -apple-system, sans-serif;
            font-size: 10pt;
            color: #64748b;
            margin-bottom: 16px;
            font-weight: 500;
        }

        .cover .meta-line {
            font-family: -apple-system, sans-serif;
            font-size: 8pt;
            color: #94a3b8;
            letter-spacing: 0.5px;
        }

        /* ==================== 分割线 ==================== */
        .divider {
            border: none;
            height: 1px;
            background: linear-gradient(to right, transparent, rgba(99,102,241,0.3), transparent);
            margin: 0 0 24px 0;
        }

        /* ==================== 指标仪表盘 & 评分明细 ==================== */
        .metrics-container {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin-bottom: 24px;
            page-break-inside: avoid;
        }
        
        .metrics-bar {
            display: flex;
            justify-content: center;
            gap: 2px;
            background: rgba(255,255,255,0.7);
            backdrop-filter: blur(8px);
            border-radius: 10px;
            border: 1px solid rgba(148,163,184,0.3);
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.02);
        }

        .metric-item {
            flex: 1;
            text-align: center;
            padding: 16px 10px;
        }

        .metric-item:not(:last-child) {
            border-right: 1px solid rgba(148,163,184,0.15);
        }

        .metric-value {
            font-family: -apple-system, sans-serif;
            font-size: 24pt;
            font-weight: 900;
            line-height: 1;
        }

        .metric-label {
            font-family: -apple-system, sans-serif;
            font-size: 8pt;
            color: #64748b;
            margin-top: 6px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        /* 扩展：评分明细表 */
        .score-breakdown {
            background: rgba(255,255,255,0.6);
            border-radius: 8px;
            border: 1px dashed rgba(99,102,241,0.3);
            padding: 12px;
        }
        .sb-table {
            width: 100%;
            border-collapse: collapse;
            font-family: -apple-system, sans-serif;
            font-size: 8.5pt;
        }
        .sb-table th {
            color: #64748b;
            font-weight: 600;
            padding: 4px 8px;
            border-bottom: 1px solid rgba(148,163,184,0.2);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .sb-table td {
            padding: 6px 8px;
            color: #334155;
            text-align: center;
        }
        .sb-table tr:not(:last-child) td {
            border-bottom: 1px dotted rgba(148,163,184,0.2);
        }

        /* ==================== 扩展：数据画像 ==================== */
        .data-profile {
            background: linear-gradient(135deg, rgba(248,250,252,0.8), rgba(241,245,249,0.8));
            border-radius: 8px;
            padding: 14px 18px;
            margin-bottom: 24px;
            border: 1px solid rgba(203,213,225,0.6);
            page-break-inside: avoid;
        }
        .data-profile h3 {
            font-family: -apple-system, sans-serif;
            font-size: 9pt;
            color: #475569;
            margin-bottom: 10px;
            font-weight: 600;
        }
        .dp-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 10px;
        }
        .dp-box {
            text-align: center;
            background: rgba(255,255,255,0.9);
            padding: 8px 4px;
            border-radius: 6px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
            border: 1px solid rgba(226,232,240,0.8);
        }
        .dp-val {
            font-family: -apple-system, sans-serif;
            font-size: 13pt;
            font-weight: 800;
            color: #334155;
            line-height: 1.1;
        }
        .dp-lbl {
            font-family: -apple-system, sans-serif;
            font-size: 7pt;
            color: #94a3b8;
            margin-top: 4px;
            font-weight: 500;
        }

        /* ==================== 摘要 Abstract ==================== */
        .abstract {
            background: rgba(255,255,255,0.6);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(99,102,241,0.2);
            border-left: 4px solid #6366f1;
            padding: 18px 22px;
            margin-bottom: 22px;
            border-radius: 0 8px 8px 0;
            box-shadow: 0 4px 12px rgba(99,102,241,0.03);
        }

        .abstract h2 {
            font-family: -apple-system, sans-serif;
            font-size: 9.5pt;
            font-weight: 800;
            color: #4f46e5;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 8px;
        }

        .abstract p {
            color: #1e293b;
            font-size: 10pt;
            font-weight: 500;
        }

        /* ==================== 核心发现 Highlights ==================== */
        .highlights {
            background: linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.06));
            border: 1px solid rgba(99,102,241,0.15);
            border-radius: 10px;
            padding: 18px 22px;
            margin-bottom: 22px;
        }

        .highlights h2 {
            font-family: -apple-system, sans-serif;
            font-size: 9pt;
            font-weight: 700;
            color: #4f46e5;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .highlights h2::before {
            content: '◆';
            font-size: 8pt;
        }

        .highlights ol {
            list-style: none;
            padding: 0;
        }

        .highlights li {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 6px 0;
            border-bottom: 1px solid rgba(99,102,241,0.08);
            font-size: 10pt;
            color: #1e293b;
            font-weight: 500;
        }

        .highlights li:last-child { border-bottom: none; }

        .kf-num {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 20px;
            height: 20px;
            background: #6366f1;
            color: white;
            font-family: -apple-system, sans-serif;
            font-size: 8pt;
            font-weight: 700;
            border-radius: 50%;
            flex-shrink: 0;
            margin-top: 1px;
        }

        /* ==================== 方法论 ==================== */
        .methodology {
            font-family: -apple-system, sans-serif;
            font-size: 8.5pt;
            color: #64748b;
            line-height: 1.6;
            padding: 12px 16px;
            background: rgba(255,255,255,0.5);
            border-radius: 6px;
            border: 1px dashed rgba(148,163,184,0.4);
            margin-bottom: 28px;
        }

        .methodology strong {
            color: #475569;
            font-size: 8pt;
            text-transform: uppercase;
            letter-spacing: 1.5px;
        }

        /* ==================== 主体章节 ==================== */
        .section {
            margin-bottom: 22px;
            page-break-inside: avoid;
            background: rgba(255,255,255,0.7);
            backdrop-filter: blur(8px);
            padding: 22px 26px;
            border-radius: 12px;
            border: 1px solid rgba(148,163,184,0.15);
            box-shadow: 0 4px 15px rgba(0,0,0,0.015);
        }

        .section h2 {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
            font-size: 13.5pt;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 14px;
            padding-bottom: 10px;
            border-bottom: 2px solid rgba(99,102,241,0.25);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .section-num {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white;
            font-size: 12pt;
            font-weight: 800;
            border-radius: 6px;
            flex-shrink: 0;
            box-shadow: 0 2px 4px rgba(99,102,241,0.3);
        }

        /* 章节内核心发现高亮 */
        .key-finding {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 12px 16px;
            background: linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.06));
            border: 1px solid rgba(251,191,36,0.3);
            border-left: 4px solid #f59e0b;
            border-radius: 0 6px 6px 0;
            margin-bottom: 16px;
            font-size: 10pt;
        }

        .kf-label {
            font-family: -apple-system, sans-serif;
            font-size: 7.5pt;
            font-weight: 800;
            color: #b45309;
            text-transform: uppercase;
            letter-spacing: 1px;
            background: rgba(251,191,36,0.2);
            padding: 3px 8px;
            border-radius: 4px;
            flex-shrink: 0;
            margin-top: 1px;
        }

        .kf-text {
            color: #92400e;
            font-weight: 700;
        }

        .section-content p {
            color: #1e293b;
            margin-bottom: 10px;
            font-size: 10.5pt;
            text-align: justify;
        }

        .section-content ul { padding-left: 20px; margin: 8px 0; }
        .section-content li { color: #334155; margin-bottom: 4px; font-size: 10pt; }
        .section-content strong { color: #0f172a; font-weight: 700; }
        .section-content code {
            background: rgba(99,102,241,0.1);
            padding: 2px 5px;
            border-radius: 4px;
            font-size: 9.5pt;
            font-family: 'Menlo', 'Consolas', monospace;
            color: #4338ca;
        }

        /* ==================== 扩展：对标论文列表 ==================== */
        .similar-papers {
            margin-bottom: 24px;
            page-break-inside: avoid;
        }
        .similar-papers h2 {
            font-family: -apple-system, sans-serif;
            font-size: 11pt;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 12px;
        }
        .sp-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .sp-item {
            background: rgba(255,255,255,0.7);
            border: 1px solid rgba(203,213,225,0.8);
            border-left: 4px solid #ef4444;
            padding: 12px 16px;
            border-radius: 0 6px 6px 0;
            font-family: -apple-system, sans-serif;
        }
        .sp-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 6px;
        }
        .sp-title {
            font-size: 10pt;
            font-weight: 600;
            color: #0f172a;
            line-height: 1.4;
        }
        .sp-year {
            font-size: 9pt;
            color: #64748b;
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            margin-left: 8px;
            flex-shrink: 0;
        }
        .sp-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 8px;
        }
        .sp-tag {
            font-size: 7.5pt;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
        }
        .sp-tag.venue { background: #e0e7ff; color: #4338ca; }
        .sp-tag.cite { background: #fce7f3; color: #be185d; }
        .sp-tag.sim { background: #fee2e2; color: #b91c1c; }
        
        .sp-diff {
            font-size: 9pt;
            color: #475569;
            background: #f8fafc;
            padding: 8px;
            border-radius: 4px;
            border: 1px dashed #cbd5e1;
        }
        .sp-diff strong {
            color: #b91c1c;
        }

        /* ==================== 结论 ==================== */
        .conclusion {
            background: linear-gradient(135deg, rgba(238,242,255,0.8), rgba(245,243,255,0.8));
            backdrop-filter: blur(8px);
            border: 1px solid rgba(99,102,241,0.25);
            padding: 22px 26px;
            border-radius: 12px;
            margin: 28px 0 24px 0;
            box-shadow: 0 4px 15px rgba(99,102,241,0.05);
        }

        .conclusion h2 {
            font-family: -apple-system, sans-serif;
            font-size: 12.5pt;
            font-weight: 800;
            color: #3730a3;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .conclusion p { color: #1e293b; font-size: 10.5pt; text-align: justify; font-weight: 500;}

        /* ==================== 行动建议 ==================== */
        .next-steps {
            margin: 0 0 28px 0;
            page-break-inside: avoid;
        }

        .next-steps h2 {
            font-family: -apple-system, sans-serif;
            font-size: 11pt;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 10px;
        }

        .next-steps ol { padding: 0; list-style: none; }

        .next-steps li {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 10px 16px;
            background: rgba(255,255,255,0.7);
            backdrop-filter: blur(4px);
            border-left: 4px solid #6366f1;
            margin-bottom: 8px;
            border-radius: 0 6px 6px 0;
            font-size: 10pt;
            color: #1e293b;
            font-weight: 500;
            border-top: 1px solid rgba(226,232,240,0.6);
            border-right: 1px solid rgba(226,232,240,0.6);
            border-bottom: 1px solid rgba(226,232,240,0.6);
        }

        .step-priority {
            font-family: -apple-system, sans-serif;
            font-size: 7.5pt;
            font-weight: 800;
            color: white;
            background: #6366f1;
            padding: 3px 6px;
            border-radius: 4px;
            flex-shrink: 0;
            margin-top: 1px;
            text-transform: uppercase;
        }
        
        /* ==================== 扩展：质量审计护栏 ==================== */
        .audit-bar {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin: 20px 0;
        }
        .audit-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-family: -apple-system, sans-serif;
            font-size: 8pt;
            font-weight: 600;
            padding: 6px 12px;
            border-radius: 20px;
        }
        .audit-badge.passed { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .audit-badge.warn { background: #fef08a; color: #854d0e; border: 1px solid #fde047; }
        .audit-badge.consensus { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
        .audit-score { font-size: 7.5pt; opacity: 0.8; font-weight: normal; }

        /* ==================== 页脚 ==================== */
        .footer {
            margin-top: 36px;
            padding-top: 16px;
            border-top: 1px solid rgba(148,163,184,0.4);
            font-family: -apple-system, sans-serif;
            font-size: 7.5pt;
            color: #64748b;
            text-align: center;
            line-height: 1.6;
        }

        .footer .disclaimer {
            margin-top: 6px;
            font-style: italic;
            color: #94a3b8;
        }

        /* ==================== 打印 ==================== */
        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                background: #fff !important;
                background-attachment: scroll !important;
            }
            /* 移除固定定位伪元素（在每页重复但不携带内容，造成大面积空白） */
            body::before {
                display: none !important;
            }
            .page-wrapper {
                max-width: 100% !important;
                width: 100% !important;
            }
            /* 打印引擎不支持 backdrop-filter，移除并设实心背景兜底 */
            .metrics-bar,
            .abstract,
            .section,
            .next-steps li {
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                background: rgba(255,255,255,0.95) !important;
            }
            .section { page-break-inside: avoid; }
            .similar-papers { page-break-inside: avoid; }
            .highlights { page-break-inside: avoid; }
            .conclusion { page-break-inside: avoid; }
            .next-steps { page-break-inside: avoid; }
            .data-profile { page-break-inside: avoid; }
            .metrics-container { page-break-inside: avoid; }
            .cover { page-break-after: avoid; }
        }
    </style>
</head>
<body>
<div class="page-wrapper">

    <!-- 封面 -->
    <div class="cover">
        <div class="brand">
            <svg class="brand-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 4C12 8.4 8.4 12 4 12C8.4 12 12 15.6 12 20C12 15.6 15.6 12 20 12C15.6 12 12 8.4 12 4Z"/>
                <path d="M19 2v4"/><path d="M17 4h4"/>
                <circle cx="5" cy="19" r="1.5"/>
            </svg>
            NovaScan
        </div>
        <h1>${report.title}</h1>
        <div class="subtitle">${report.subtitle}</div>
        <div class="meta-line">${date} &nbsp;&bull;&nbsp; ${report.usedModel || 'AI'} &nbsp;&bull;&nbsp; NovaScan Multi-Agent System v1.0</div>
    </div>

    <hr class="divider" />

    <!-- 指标仪表盘 & 评分明细 -->
    <div class="metrics-container">
        <div class="metrics-bar">
            <div class="metric-item">
                <div class="metric-value" style="color:${getScoreColor(report.overallScore)}">${report.overallScore}</div>
                <div class="metric-label">${isZh ? '综合创新分' : 'Innovation'}</div>
            </div>
            <div class="metric-item">
                <div class="metric-value" style="color:${getScoreColor(report.industryScore)}">${report.industryScore}</div>
                <div class="metric-label">${isZh ? '产业可行性' : 'Feasibility'}</div>
            </div>
            <div class="metric-item">
                <div class="metric-value" style="color:${report.credibilityLevel === 'high' ? '#059669' : report.credibilityLevel === 'medium' ? '#d97706' : '#dc2626'}; font-size: 15pt;">
                    ${getCredibilityLabel(report.credibilityLevel, isZh)}
                </div>
                <div class="metric-label">${isZh ? '交叉验证' : 'Validation'}</div>
            </div>
        </div>
        ${scoreBreakdownHtml}
    </div>

    <!-- 摘要 -->
    <div class="abstract">
        <h2>${isZh ? 'Abstract — 摘要' : 'Abstract'}</h2>
        <p>${markdownToHtml(report.executiveSummary)}</p>
    </div>

    <!-- 核心发现 Highlights -->
    ${report.keyFindings && report.keyFindings.length > 0 ? `
    <div class="highlights">
        <h2>${isZh ? 'Key Findings — 核心发现' : 'Key Findings'}</h2>
        <ol>${keyFindingsHtml}</ol>
    </div>
    ` : ''}

    <!-- 方法论 -->
    <div class="methodology">
        <strong>${isZh ? 'Methodology — 研究方法' : 'Methodology'}</strong><br/>
        ${report.methodology}
    </div>
    
    <!-- 数据流侧写 -->
    ${dataProfileHtml}

    <!-- 主体章节 -->
    ${sectionsHtml}
    
    <!-- 关键文献对标 -->
    ${similarPapersHtml}

    <!-- 结论与展望 -->
    <div class="conclusion">
        <h2>${isZh ? '结论与展望' : 'Conclusion & Outlook'}</h2>
        <p>${markdownToHtml(report.conclusion)}</p>
    </div>

    <!-- 行动建议 -->
    ${report.nextSteps.length > 0 ? `
    <div class="next-steps">
        <h2>${isZh ? '⚡ 行动建议（按优先级）' : '⚡ Action Items (by Priority)'}</h2>
        <ol>${nextStepsHtml}</ol>
    </div>
    ` : ''}
    
    <!-- 质量审计系统底栏 -->
    ${auditHtml}

    <!-- 页脚 -->
    <div class="footer">
        <div>${report.dataSourcesSummary}</div>
        <div class="disclaimer">
            ${isZh
            ? '免责声明：本报告由 AI 系统自动生成，数据基于公开数据源的自动化检索，仅供研究参考，不构成投资或决策建议。'
            : 'Disclaimer: AI-generated report based on automated retrieval from public data sources. For research reference only.'
        }
        </div>
    </div>

</div>
</body>
</html>`;
}

/**
 * 导出 PDF — 通过隐藏 iframe + window.print()
 */
export function exportReportAsPDF(report: ProfessionalReport): void {
    const html = buildReportHtml(report);

    const iframe = document.createElement('iframe');
    // 使用屏幕外的全尺寸 iframe 而非零宽高，确保浏览器完整渲染内容
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:800px;height:600px;border:none;visibility:hidden;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
        document.body.removeChild(iframe);
        throw new Error('Unable to create print iframe');
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // 使用 onload 事件确保 HTML 完全渲染后再触发打印
    iframe.onload = () => {
        setTimeout(() => {
            try {
                iframe.contentWindow?.print();
            } catch (e) {
                console.error('[PDF Generator] Print failed:', e);
            }
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 1000);
        }, 300);
    };

    // 兜底：如果 onload 未触发（某些浏览器对 srcdoc/write 不触发 onload），设置较长超时
    setTimeout(() => {
        if (document.body.contains(iframe)) {
            try {
                iframe.contentWindow?.print();
            } catch (e) {
                console.error('[PDF Generator] Fallback print failed:', e);
            }
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 1000);
        }
    }, 3000);
}