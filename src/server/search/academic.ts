import { searchOpenAlex } from '@/server/academic/openalex'
import { searchCrossRef } from '@/server/academic/crossref'
import { searchCore } from '@/server/academic/core'
import { searchArxiv } from '@/server/academic/arxiv'

export async function searchAcademic(keywords: string[], domain?: string) {
    // 并行调用4源
    const [openAlex, crossRef, core, arxiv] = await Promise.all([
        searchOpenAlex(keywords, { fromYear: 2020, perPage: 10 }).catch(err => {
            console.error('[OpenAlex] 失败:', err.message)
            return []
        }),
        searchCrossRef(keywords, { fromYear: 2020, rows: 10 }).catch(err => {
            console.error('[CrossRef] 失败:', err.message)
            return []
        }),
        searchCore(keywords, { fromYear: 2020, limit: 10 }).catch(err => {
            console.error('[CORE] 失败:', err.message)
            return []
        }),
        searchArxiv(keywords, { fromYear: 2020, maxResults: 10 }).catch(err => {
            console.error('[arXiv] 失败:', err.message)
            return []
        })
    ])

    // 合并结果
    const merged = [...openAlex, ...crossRef, ...core, ...arxiv]

    // 去重（基于标题）
    const seen = new Set()
    const unique = merged.filter(paper => {
        const key = paper.title?.toLowerCase().trim()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })

    const results = unique.slice(0, 20);

    return {
        success: true,
        sources: {
            openAlex: openAlex.length,
            crossRef: crossRef.length,
            core: core.length,
            arxiv: arxiv.length
        },
        total: unique.length,
        results
    }
}
