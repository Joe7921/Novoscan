/**
 * NovoStarchart 快速验证脚本
 * 只跑 3 个极端案例，验证修复后分数是否差异化
 */
const API_BASE = `http://localhost:${process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : '3001'}`;

const QUICK_CASES = [
    { id: 'Q1_copycat', query: '做一个和淘宝一样的电商平台，卖各种商品', expect: '六维应低' },
    { id: 'Q2_disruptive', query: '利用 AlphaFold 蛋白质结构预测技术，结合 CRISPR 基因编辑，开发全自动化的个性化 mRNA 疫苗设计平台', expect: '技术突破应高' },
    { id: 'Q3_nonsense', query: 'asdf jkl; 1234 qwer!!! ???', expect: '全维度应极低' },
];

const EXAMPLE_FINGERPRINT = [75, 60, 70, 65, 50, 45];
const SIX_DIMS = ['techBreakthrough', 'businessModel', 'userExperience', 'orgCapability', 'networkEcosystem', 'socialImpact'];

async function callAPI(query) {
    const start = Date.now();
    console.log(`  🔄 调用: "${query.slice(0, 50)}..."`);
    const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, language: 'zh', modelProvider: 'minimax', privacyMode: true }),
    });
    const text = await res.text();
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
        try {
            const ev = JSON.parse(line);
            if (ev.type === 'done') {
                console.log(`  ✅ 完成 (${((Date.now() - start) / 1000).toFixed(0)}s)`);
                return ev.data;
            }
        } catch { }
    }
    console.log(`  ❌ 失败 (${((Date.now() - start) / 1000).toFixed(0)}s)`);
    return null;
}

async function main() {
    console.log('=== NovoStarchart 修复快速验证 ===\n');

    let allSame = true;
    let copiedExample = 0;
    const results = [];

    for (const tc of QUICK_CASES) {
        console.log(`\n[${tc.id}] ${tc.expect}`);
        const data = await callAPI(tc.query);
        const radar = data?.innovationRadar;

        if (!radar || !Array.isArray(radar)) {
            console.log('  ⚠️ 没有雷达数据');
            results.push({ id: tc.id, scores: null });
            continue;
        }

        const scores = {};
        for (const dim of radar) scores[dim.key] = dim.score;
        const vals = SIX_DIMS.map(d => scores[d] ?? '?');
        console.log(`  六维: [${vals.join(', ')}]`);

        // 检测是否复制了示例值
        const isExampleCopy = SIX_DIMS.every((k, i) => scores[k] === EXAMPLE_FINGERPRINT[i]);
        if (isExampleCopy) {
            console.log('  🚩 仍然等于示例值 [75,60,70,65,50,45]!');
            copiedExample++;
        } else {
            console.log('  ✅ 分数已差异化');
        }

        results.push({ id: tc.id, scores, isExampleCopy, overallScore: data?.noveltyScore });
    }

    // 检查各用例之间的差异
    const validResults = results.filter(r => r.scores);
    if (validResults.length >= 2) {
        const first = validResults[0].scores;
        const second = validResults[1].scores;
        const areDifferent = SIX_DIMS.some(d => first[d] !== second[d]);
        if (!areDifferent) {
            console.log('\n🚩 不同创意的分数完全相同！');
        } else {
            allSame = false;
            console.log('\n✅ 不同创意的分数有差异');
        }
    }

    console.log('\n=== 验证结果 ===');
    console.log(`示例值复制: ${copiedExample}/${QUICK_CASES.length} ${copiedExample === 0 ? '✅ 修复成功' : '⚠️ 仍有复制'}`);
    console.log(`跨用例差异: ${!allSame ? '✅ 有差异' : '❌ 无差异'}`);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
