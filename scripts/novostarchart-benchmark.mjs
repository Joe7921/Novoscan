/**
 * NovoStarchart 六维评分自动化基准测试脚本
 * 
 * 测试内容：
 *   方法1 - 极端案例测试（Boundary Testing）：6 个边界用例
 *   方法2 - 重测稳定性（Test-Retest）：3 条创意各跑 3 次
 *   方法3 - 维度区分度分析：基于所有结果计算维度相关矩阵
 * 
 * 用法：node scripts/novostarchart-benchmark.mjs [--port 3001]
 * 
 * 结果保存至：scripts/benchmark-results-<timestamp>.json
 */

const API_BASE = `http://localhost:${process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : '3001'}`;

// ==================== 测试用例定义 ====================

/** 极端案例（方法3）：每条含预期，用于判断 pass/fail */
const BOUNDARY_CASES = [
    {
        id: 'B1_copycat',
        query: '做一个和淘宝一样的电商平台，卖各种商品',
        expectedLevel: 'low',
        expectations: {
            techBreakthrough: { max: 35 },
            businessModel: { max: 35 },
            overallAvg: { max: 35 },
        },
        reason: '完全复制已有产品，各维度应极低'
    },
    {
        id: 'B2_disruptive',
        query: '利用 AlphaFold 蛋白质结构预测技术，结合 CRISPR 基因编辑，开发全自动化的个性化 mRNA 疫苗设计平台，从抗原筛选到序列优化全流程 AI 驱动',
        expectedLevel: 'high',
        expectations: {
            techBreakthrough: { min: 65 },
            userExperience: { min: 50 },
            overallAvg: { min: 60 },
        },
        reason: '多项前沿技术交叉的颠覆式创新'
    },
    {
        id: 'B3_pure_academic',
        query: '用拓扑量子计算研究高维弦理论的非微扰效应',
        expectedLevel: 'academic',
        expectations: {
            techBreakthrough: { min: 50 },
            orgCapability: { max: 45 },
        },
        reason: '纯学术概念，技术前沿但落地能力应低'
    },
    {
        id: 'B4_esg',
        query: '基于卫星遥感和 AI 的全球珊瑚礁健康实时监测与碳汇量化平台，向发展中国家免费开放数据',
        expectedLevel: 'esg',
        expectations: {
            socialImpact: { min: 60 },
        },
        reason: 'ESG 色彩明显，社会贡献维度应显著偏高'
    },
    {
        id: 'B5_platform',
        query: '构建面向全球开发者的 AI Agent 协作网络，任何人可以发布、组合、货币化自己的 AI Agent，形成去中心化的智能服务市场',
        expectedLevel: 'platform',
        expectations: {
            networkEcosystem: { min: 60 },
        },
        reason: '平台型生态创意，网络协同应远高于其他维度'
    },
    {
        id: 'B6_nonsense',
        query: 'asdf jkl; 1234 qwer!!! ???',
        expectedLevel: 'nonsense',
        expectations: {
            overallAvg: { max: 30 },
        },
        reason: '无意义输入，全维度应极低'
    },
];

/** 重测稳定性用例（方法1）*/
const RETEST_CASES = [
    { id: 'R1', query: '用大语言模型自动生成和优化数据库SQL查询的智能中间件' },
    { id: 'R2', query: '基于脑机接口的实时情绪识别与音乐推荐系统' },
    { id: 'R3', query: '利用联邦学习实现跨医院的罕见病诊断AI模型协同训练' },
];
const RETEST_ROUNDS = 3;

// ==================== 工具函数 ====================

const SIX_DIMS = ['techBreakthrough', 'businessModel', 'userExperience', 'orgCapability', 'networkEcosystem', 'socialImpact'];

const TIMEOUT_MS = 5 * 60 * 1000; // 单次 API 调用 5 分钟超时
let _callCount = 0;
let _totalCalls = BOUNDARY_CASES.length + RETEST_CASES.length * RETEST_ROUNDS; // 预估总数

/** 调用 /api/analyze，返回解析后的 done 事件数据 */
async function callAnalyzeAPI(query) {
    _callCount++;
    const startMs = Date.now();
    const pct = ((_callCount / _totalCalls) * 100).toFixed(0);
    console.log(`    🔄 [${_callCount}/${_totalCalls} ${pct}%] 调用 API: "${query.slice(0, 40)}..."`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                language: 'zh',
                modelProvider: 'minimax',
                privacyMode: true,    // 不污染数据库
            }),
            signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
            throw new Error(`API 返回 ${res.status}: ${await res.text()}`);
        }

        // 解析 NDJSON 流
        const text = await res.text();
        const lines = text.split('\n').filter(l => l.trim());

        let doneData = null;
        let errorData = null;

        for (const line of lines) {
            try {
                const event = JSON.parse(line);
                if (event.type === 'done') doneData = event.data;
                if (event.type === 'error') errorData = event.data;
            } catch { /* 忽略非 JSON 行 */ }
        }

        const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);

        if (errorData) {
            console.log(`    ❌ API 错误 (${elapsedSec}s): ${errorData.message}`);
            return null;
        }
        if (!doneData) {
            console.log(`    ❌ 未收到 done 事件 (${elapsedSec}s)`);
            return null;
        }

        console.log(`    ✅ 完成 (${elapsedSec}s) | 综合分: ${doneData.noveltyScore} | 雷达: ${doneData.innovationRadar ? '有' : '无'}`);
        return doneData;
    } catch (err) {
        clearTimeout(timer);
        const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
        if (err.name === 'AbortError') {
            console.log(`    ⏰ 超时 (${elapsedSec}s > ${TIMEOUT_MS / 1000}s)`);
        } else {
            console.log(`    ❌ 请求异常 (${elapsedSec}s): ${err.message}`);
        }
        return null;
    }
}

/** 从 API 返回数据提取六维分数对象 */
function extractRadarScores(data) {
    if (!data?.innovationRadar || !Array.isArray(data.innovationRadar)) return null;
    const scores = {};
    for (const dim of data.innovationRadar) {
        scores[dim.key] = dim.score;
    }
    return scores;
}

/** 计算平均值 */
function mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/** 计算标准差 */
function stdDev(arr) {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

/** 计算变异系数 CV */
function cv(arr) {
    const m = mean(arr);
    if (m === 0) return Infinity;
    return (stdDev(arr) / m) * 100;
}

/** 计算 Pearson 相关系数 */
function pearson(a, b) {
    const n = a.length;
    const ma = mean(a), mb = mean(b);
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) {
        num += (a[i] - ma) * (b[i] - mb);
        da += (a[i] - ma) ** 2;
        db += (b[i] - mb) ** 2;
    }
    const denom = Math.sqrt(da * db);
    return denom === 0 ? 0 : num / denom;
}

// ==================== 测试执行 ====================

async function runBoundaryTests() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 方法 3：极端案例测试（Boundary Testing）');
    console.log('='.repeat(60));

    const results = [];

    for (const tc of BOUNDARY_CASES) {
        console.log(`\n  🧪 [${tc.id}] ${tc.reason}`);
        const data = await callAnalyzeAPI(tc.query);
        const scores = extractRadarScores(data);

        const result = {
            id: tc.id,
            query: tc.query,
            expectedLevel: tc.expectedLevel,
            reason: tc.reason,
            overallScore: data?.noveltyScore ?? null,
            practicalScore: data?.practicalScore ?? null,
            radarScores: scores,
            checks: [],
            passed: true,
        };

        if (!scores) {
            result.passed = false;
            result.checks.push({ check: '雷达数据存在', passed: false });
            results.push(result);
            continue;
        }

        const overallAvg = mean(Object.values(scores));

        // 执行预期检查
        for (const [key, cond] of Object.entries(tc.expectations)) {
            const value = key === 'overallAvg' ? overallAvg : scores[key];
            let checkPassed = true;
            let detail = '';

            if (cond.min !== undefined && value < cond.min) {
                checkPassed = false;
                detail = `${key}=${Math.round(value)} < 预期最低 ${cond.min}`;
            }
            if (cond.max !== undefined && value > cond.max) {
                checkPassed = false;
                detail = `${key}=${Math.round(value)} > 预期最高 ${cond.max}`;
            }
            if (checkPassed) {
                detail = `${key}=${Math.round(value)} ✓`;
            }

            result.checks.push({ check: key, value: Math.round(value), ...cond, passed: checkPassed, detail });
            if (!checkPassed) result.passed = false;
        }

        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`    ${status} | 六维: ${SIX_DIMS.map(d => `${d.slice(0, 4)}=${scores[d]}`).join(', ')} | avg=${overallAvg.toFixed(1)}`);
        for (const c of result.checks) {
            console.log(`      ${c.passed ? '✓' : '✗'} ${c.detail}`);
        }

        results.push(result);
    }

    const passCount = results.filter(r => r.passed).length;
    console.log(`\n  📊 极端案例结果: ${passCount}/${results.length} 通过 ${passCount >= 5 ? '✅ 达标' : '❌ 未达标'}`);

    return results;
}

async function runRetestStability() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 方法 1：重测稳定性（Test-Retest）');
    console.log(`   每条创意跑 ${RETEST_ROUNDS} 次`);
    console.log('='.repeat(60));

    const results = [];

    for (const tc of RETEST_CASES) {
        console.log(`\n  🧪 [${tc.id}] "${tc.query.slice(0, 35)}..."`);

        const rounds = [];
        for (let r = 0; r < RETEST_ROUNDS; r++) {
            console.log(`    --- Round ${r + 1}/${RETEST_ROUNDS} ---`);
            const data = await callAnalyzeAPI(tc.query);
            const scores = extractRadarScores(data);
            rounds.push({
                round: r + 1,
                overallScore: data?.noveltyScore ?? null,
                radarScores: scores,
            });
        }

        // 计算每个维度的 CV（变异系数）
        const dimStats = {};
        for (const dim of SIX_DIMS) {
            const vals = rounds.map(r => r.radarScores?.[dim]).filter(v => typeof v === 'number');
            if (vals.length >= 2) {
                dimStats[dim] = {
                    values: vals,
                    mean: mean(vals).toFixed(1),
                    stdDev: stdDev(vals).toFixed(1),
                    cv: cv(vals).toFixed(1),
                    stable: cv(vals) < 15,
                };
            }
        }

        // 总分稳定性
        const overallVals = rounds.map(r => r.overallScore).filter(v => typeof v === 'number');
        const overallStats = overallVals.length >= 2 ? {
            values: overallVals,
            mean: mean(overallVals).toFixed(1),
            stdDev: stdDev(overallVals).toFixed(1),
            cv: cv(overallVals).toFixed(1),
        } : null;

        const stableCount = Object.values(dimStats).filter(d => d.stable).length;

        console.log(`    📊 总分: ${overallStats ? `μ=${overallStats.mean}, σ=${overallStats.stdDev}, CV=${overallStats.cv}%` : 'N/A'}`);
        for (const [dim, st] of Object.entries(dimStats)) {
            console.log(`       ${st.stable ? '✓' : '✗'} ${dim}: [${st.values.join(',')}] μ=${st.mean} σ=${st.stdDev} CV=${st.cv}%`);
        }
        console.log(`    稳定维度: ${stableCount}/${Object.keys(dimStats).length}`);

        results.push({
            id: tc.id,
            query: tc.query,
            rounds,
            dimStats,
            overallStats,
            stableDimCount: stableCount,
            totalDimCount: Object.keys(dimStats).length,
        });
    }

    return results;
}

function runDimensionAnalysis(allScoresList) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 方法 4：维度区分度分析');
    console.log('='.repeat(60));

    // 过滤出有效的雷达分数
    const validScores = allScoresList.filter(s => s !== null);
    console.log(`  有效数据点: ${validScores.length}`);

    if (validScores.length < 3) {
        console.log('  ⚠️ 数据点不足，跳过维度分析');
        return { skipped: true };
    }

    // 1. 每条创意六维的标准差（维度间区分度）
    const intraStds = validScores.map(s => {
        const vals = SIX_DIMS.map(d => s[d]).filter(v => typeof v === 'number');
        return vals.length >= 2 ? stdDev(vals) : null;
    }).filter(v => v !== null);

    const avgIntraStd = mean(intraStds);
    console.log(`\n  维度间标准差（单条创意六维 std）:`);
    console.log(`    平均: ${avgIntraStd.toFixed(1)} ${avgIntraStd > 12 ? '✅ > 12, 区分度良好' : '⚠️ < 12, AI 可能在打安全分'}`);

    // 2. 维度间相关矩阵
    console.log(`\n  维度间 Pearson 相关矩阵:`);
    const correlationMatrix = {};
    const dimLabels = SIX_DIMS.map(d => d.slice(0, 6));

    // 表头
    console.log(`    ${''.padEnd(12)} ${dimLabels.map(l => l.padStart(8)).join('')}`);

    const highCorrelations = [];

    for (let i = 0; i < SIX_DIMS.length; i++) {
        const row = {};
        let rowStr = `    ${dimLabels[i].padEnd(12)}`;
        for (let j = 0; j < SIX_DIMS.length; j++) {
            if (i === j) {
                row[SIX_DIMS[j]] = 1.0;
                rowStr += '    1.00';
                continue;
            }
            const a = validScores.map(s => s[SIX_DIMS[i]]).filter(v => typeof v === 'number');
            const b = validScores.map(s => s[SIX_DIMS[j]]).filter(v => typeof v === 'number');
            const minLen = Math.min(a.length, b.length);
            const r = minLen >= 3 ? pearson(a.slice(0, minLen), b.slice(0, minLen)) : null;
            row[SIX_DIMS[j]] = r;
            rowStr += r !== null ? `    ${r.toFixed(2)}` : '     N/A';

            if (r !== null && Math.abs(r) > 0.85 && i < j) {
                highCorrelations.push({ dim1: SIX_DIMS[i], dim2: SIX_DIMS[j], r: r.toFixed(2) });
            }
        }
        correlationMatrix[SIX_DIMS[i]] = row;
        console.log(rowStr);
    }

    if (highCorrelations.length > 0) {
        console.log(`\n  🚩 高相关维度对（r > 0.85, 可能冗余）:`);
        for (const hc of highCorrelations) {
            console.log(`    ${hc.dim1} ↔ ${hc.dim2}: r = ${hc.r}`);
        }
    } else {
        console.log(`\n  ✅ 无高相关维度对，各维度独立性良好`);
    }

    return {
        avgIntraStd: parseFloat(avgIntraStd.toFixed(1)),
        intraStdGood: avgIntraStd > 12,
        correlationMatrix,
        highCorrelations,
        noRedundancy: highCorrelations.length === 0,
    };
}

// ==================== 主流程 ====================

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║       NovoStarchart 六维评分基准测试                    ║');
    console.log('║       自动化评估：成功率 + 准确度 + 区分度             ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`  API: ${API_BASE}/api/analyze`);
    console.log(`  时间: ${new Date().toISOString()}`);
    console.log(`  模式: privacyMode=true (不写入数据库)`);

    const allRadarScores = []; // 收集所有雷达分数用于维度分析

    // 1. 极端案例测试
    const boundaryResults = await runBoundaryTests();
    for (const r of boundaryResults) {
        if (r.radarScores) allRadarScores.push(r.radarScores);
    }

    // 2. 重测稳定性
    const retestResults = await runRetestStability();
    for (const r of retestResults) {
        for (const round of r.rounds) {
            if (round.radarScores) allRadarScores.push(round.radarScores);
        }
    }

    // 3. 维度区分度分析（使用全部数据）
    const dimensionAnalysis = runDimensionAnalysis(allRadarScores);

    // ==================== 汇总 ====================
    console.log('\n' + '='.repeat(60));
    console.log('📋 最终汇总');
    console.log('='.repeat(60));

    const boundaryPassRate = boundaryResults.filter(r => r.passed).length / boundaryResults.length;
    const avgStableDimRate = retestResults.length > 0
        ? mean(retestResults.map(r => r.totalDimCount > 0 ? r.stableDimCount / r.totalDimCount : 0))
        : null;

    const summary = {
        timestamp: new Date().toISOString(),
        apiBase: API_BASE,
        boundaryTest: {
            total: boundaryResults.length,
            passed: boundaryResults.filter(r => r.passed).length,
            passRate: (boundaryPassRate * 100).toFixed(0) + '%',
            verdict: boundaryPassRate >= 5 / 6 ? 'PASS' : 'FAIL',
        },
        retestStability: {
            cases: retestResults.length,
            roundsPerCase: RETEST_ROUNDS,
            avgStableDimRate: avgStableDimRate !== null ? (avgStableDimRate * 100).toFixed(0) + '%' : 'N/A',
        },
        dimensionAnalysis: {
            dataPoints: allRadarScores.length,
            avgIntraStd: dimensionAnalysis.avgIntraStd,
            intraStdGood: dimensionAnalysis.intraStdGood,
            noRedundancy: dimensionAnalysis.noRedundancy,
        },
    };

    console.log(`  极端案例: ${summary.boundaryTest.passed}/${summary.boundaryTest.total} 通过 (${summary.boundaryTest.passRate}) → ${summary.boundaryTest.verdict}`);
    console.log(`  重测稳定性: 平均 ${summary.retestStability.avgStableDimRate} 维度 CV<15%`);
    console.log(`  维度区分度: 平均 std=${summary.dimensionAnalysis.avgIntraStd} ${summary.dimensionAnalysis.intraStdGood ? '✅' : '⚠️'} | 冗余=${summary.dimensionAnalysis.noRedundancy ? '无 ✅' : '有 ⚠️'}`);

    // 保存完整结果
    const fullReport = {
        summary,
        boundaryResults,
        retestResults,
        dimensionAnalysis,
        allRadarScores,
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputPath = `scripts/benchmark-results-${timestamp}.json`;

    const fs = await import('fs');
    fs.writeFileSync(outputPath, JSON.stringify(fullReport, null, 2), 'utf-8');
    console.log(`\n  💾 完整结果已保存: ${outputPath}`);
    console.log('\n✅ 基准测试完成！将结果文件交给 AI 进行评估分析。');
}

main().catch(err => {
    console.error('❌ 测试异常中断:', err);
    process.exit(1);
});
