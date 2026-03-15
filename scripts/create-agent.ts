#!/usr/bin/env node
/**
 * 🧩 Novoscan Agent 脚手架
 *
 * 交互式 CLI 工具，一键生成 Agent 插件模板。
 * 用法：npm run create-agent
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// ==================== 颜色工具 ====================
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  bgCyan: '\x1b[46m\x1b[30m',
}

function log(msg: string) { console.log(msg) }
function success(msg: string) { log(`${c.green}✅ ${msg}${c.reset}`) }
function info(msg: string) { log(`${c.cyan}ℹ  ${msg}${c.reset}`) }
function warn(msg: string) { log(`${c.yellow}⚠️  ${msg}${c.reset}`) }
function error(msg: string) { log(`${c.red}❌ ${msg}${c.reset}`) }

// ==================== 交互式输入 ====================
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function ask(question: string, defaultValue?: string): Promise<string> {
  const prompt = defaultValue
    ? `${c.cyan}? ${c.bold}${question}${c.reset} ${c.dim}(${defaultValue})${c.reset} `
    : `${c.cyan}? ${c.bold}${question}${c.reset} `
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue || '')
    })
  })
}

function askSelect(question: string, options: string[], defaultIndex = 0): Promise<string> {
  return new Promise((resolve) => {
    log(`${c.cyan}? ${c.bold}${question}${c.reset}`)
    options.forEach((opt, i) => {
      const marker = i === defaultIndex ? `${c.green}❯ ${opt}${c.reset}` : `  ${c.dim}${opt}${c.reset}`
      log(`  ${marker}`)
    })
    rl.question(`${c.dim}  输入编号 (1-${options.length}, 默认 ${defaultIndex + 1}): ${c.reset}`, (answer) => {
      const idx = answer.trim() ? parseInt(answer.trim()) - 1 : defaultIndex
      resolve(options[Math.max(0, Math.min(idx, options.length - 1))])
    })
  })
}

// ==================== 校验 ====================
const KEBAB_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

function validateId(id: string): string | null {
  if (!id) return 'ID 不能为空'
  if (!KEBAB_RE.test(id)) return 'ID 必须为 kebab-case 格式（如 my-agent）'
  return null
}

// ==================== 代码模板生成 ====================
function generateAgentCode(config: {
  id: string
  name: string
  nameEn: string
  description: string
  category: string
  author: string
  icon: string
}): string {
  return `/**
 * ${config.icon} ${config.name}（${config.nameEn}）— 社区 Agent 插件
 *
 * ${config.description}
 *
 * @author ${config.author}
 * @version 1.0.0
 */

import { defineAgent } from '@/plugins/types'
import type { AgentInput, AgentOutput, DimensionScore } from '@/agents/types'

export default defineAgent({
  id: '${config.id}',
  name: '${config.name}',
  nameEn: '${config.nameEn}',
  description: '${config.description}',
  version: '1.0.0',
  author: '${config.author}',
  category: '${config.category}',
  icon: '${config.icon}',

  async analyze(input: AgentInput): Promise<AgentOutput> {
    const { query, academicData, industryData, language } = input

    // ──────────────────────────────────────────────
    // 🎯 在这里实现你的分析逻辑
    //
    // 你可以：
    // 1. 调用外部 API 获取额外数据
    // 2. 使用 academicData / industryData 中的检索结果
    // 3. 通过 input.onProgress?.('log', '正在分析...') 推送进度
    //
    // 提示：使用 Mock AI 模式 (MOCK_AI=true) 可以零 Key 测试
    // ──────────────────────────────────────────────

    // 示例：基于检索到的论文数量计算基础分
    const paperCount = academicData?.results?.length || 0
    const githubCount = industryData?.githubResults?.length || 0
    const baseScore = Math.min(95, Math.max(20, 70 - paperCount * 2 + githubCount * 3))

    // 构建多维评分
    const dimensionScores: DimensionScore[] = [
      {
        name: language === 'zh' ? '维度 A' : 'Dimension A',
        score: baseScore,
        reasoning: language === 'zh'
          ? '基于检索数据的初步评估'
          : 'Preliminary assessment based on search data',
      },
      {
        name: language === 'zh' ? '维度 B' : 'Dimension B',
        score: Math.max(15, baseScore - 10),
        reasoning: language === 'zh'
          ? '综合考虑市场和学术因素'
          : 'Considering both market and academic factors',
      },
    ]

    return {
      agentName: language === 'zh' ? '${config.name}' : '${config.nameEn}',
      analysis: language === 'zh'
        ? \`## ${config.icon} ${config.name}分析报告\\n\\n针对 "\${query}" 的分析结果...\\n\\n> 🚧 这是模板代码，请替换为你的真实分析逻辑。\`
        : \`## ${config.icon} ${config.nameEn} Report\\n\\nAnalysis for "\${query}"...\\n\\n> 🚧 This is template code. Replace with your real analysis logic.\`,
      score: baseScore,
      confidence: baseScore >= 70 ? 'high' : baseScore >= 40 ? 'medium' : 'low',
      confidenceReasoning: language === 'zh'
        ? '基于模板逻辑的初步评估，请替换为真实的置信度分析'
        : 'Preliminary assessment from template logic. Replace with real confidence analysis.',
      keyFindings: [
        language === 'zh' ? \`检索到 \${paperCount} 篇相关论文\` : \`Found \${paperCount} related papers\`,
        language === 'zh' ? \`发现 \${githubCount} 个相关 GitHub 项目\` : \`Found \${githubCount} related GitHub repos\`,
      ],
      redFlags: [],
      evidenceSources: [
        \`学术检索: \${paperCount} 条结果\`,
        \`产业检索: \${githubCount} 条 GitHub 结果\`,
      ],
      reasoning: language === 'zh'
        ? '通过分析学术和产业数据，综合评估创新点的独特性。'
        : 'Assessed innovation uniqueness by analyzing academic and industry data.',
      dimensionScores,
    }
  },
})
`
}

// ==================== Manifest 模板生成 ====================
function generateManifest(config: {
  id: string
  name: string
  nameEn: string
  description: string
  category: string
  author: string
  icon: string
}): string {
  const manifest = {
    id: config.id,
    name: config.name,
    nameEn: config.nameEn,
    description: config.description,
    version: '1.0.0',
    author: config.author,
    category: config.category,
    icon: config.icon,
    tags: [],
    license: 'MIT',
    minNovoscanVersion: '1.0.0',
    entryPoint: 'index.ts',
    permissions: [] as string[],
    screenshots: [] as string[],
    pricing: 'free',
  }
  return JSON.stringify(manifest, null, 2) + '\n'
}

// ==================== 主流程 ====================
async function main() {
  log('')
  log(`${c.bgCyan}                                        ${c.reset}`)
  log(`${c.bgCyan}   🧩 Novoscan Agent Generator v1.0.0   ${c.reset}`)
  log(`${c.bgCyan}                                        ${c.reset}`)
  log('')
  log(`${c.dim}  创建你的第一个 Agent 插件，只需回答几个问题。${c.reset}`)
  log(`${c.dim}  文档: src/plugins/README.md${c.reset}`)
  log('')

  // 1. 收集信息
  const id = await ask('Agent ID (kebab-case, 如 my-agent):')
  const idError = validateId(id)
  if (idError) {
    error(idError)
    rl.close()
    process.exit(1)
  }

  const name = await ask('名称（中文）:', `${id}-Agent`)
  const nameEn = await ask('名称（英文）:', id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '))
  const description = await ask('一句话描述:')
  const category = await askSelect('分类:', ['academic', 'industry', 'specialized', 'community'], 3)
  const author = await ask('作者:', 'Community')
  const icon = await ask('Icon (emoji):', '🤖')

  log('')
  log(`${c.dim}─────────────────────────────────────────${c.reset}`)
  log(`${c.bold}  即将创建:${c.reset}`)
  log(`  ID:       ${c.cyan}${id}${c.reset}`)
  log(`  名称:     ${c.cyan}${icon} ${name} (${nameEn})${c.reset}`)
  log(`  分类:     ${c.cyan}${category}${c.reset}`)
  log(`  作者:     ${c.cyan}${author}${c.reset}`)
  log(`${c.dim}─────────────────────────────────────────${c.reset}`)
  log('')

  const confirm = await ask('确认创建? (Y/n):', 'Y')
  if (confirm.toLowerCase() === 'n') {
    warn('已取消')
    rl.close()
    return
  }

  // 2. 生成文件
  const projectRoot = path.resolve(__dirname, '..')
  const pluginDir = path.join(projectRoot, 'src', 'plugins', 'agents', id)
  const pluginFile = path.join(pluginDir, 'index.ts')

  // 检查目录是否已存在
  if (fs.existsSync(pluginDir)) {
    error(`目录已存在: ${pluginDir}`)
    error('请选择一个不同的 ID，或手动删除该目录。')
    rl.close()
    process.exit(1)
  }

  // 创建目录
  fs.mkdirSync(pluginDir, { recursive: true })
  // 写入 Agent 模板
  fs.writeFileSync(pluginFile, generateAgentCode({ id, name, nameEn, description, category, author, icon }), 'utf-8')
  success(`已创建: src/plugins/agents/${id}/index.ts`)

  // 写入 plugin-manifest.json
  const manifestFile = path.join(pluginDir, 'plugin-manifest.json')
  fs.writeFileSync(manifestFile, generateManifest({ id, name, nameEn, description, category, author, icon }), 'utf-8')
  success(`已创建: src/plugins/agents/${id}/plugin-manifest.json`)

  // 3. 在 discovery.ts 中注册
  const discoveryPath = path.join(projectRoot, 'src', 'plugins', 'discovery.ts')
  if (fs.existsSync(discoveryPath)) {
    let discoveryContent = fs.readFileSync(discoveryPath, 'utf-8')
    // 在 PLUGIN_MODULES 对象中追加新条目
    const insertMarker = `'patent-scout': () => import('./agents/patent-scout/index'),`
    if (discoveryContent.includes(insertMarker)) {
      discoveryContent = discoveryContent.replace(
        insertMarker,
        `${insertMarker}\n  '${id}': () => import('./agents/${id}/index'),`
      )
      fs.writeFileSync(discoveryPath, discoveryContent, 'utf-8')
      success(`已注册到 discovery.ts`)
    } else {
      warn('未能自动注册到 discovery.ts，请手动添加以下行:')
      log(`  '${id}': () => import('./agents/${id}/index'),`)
    }
  }

  // 4. 完成提示
  log('')
  log(`${c.green}${c.bold}🎉 Agent "${name}" 创建成功！${c.reset}`)
  log('')
  log(`${c.bold}📂 文件位置:${c.reset}`)
  log(`   src/plugins/agents/${id}/index.ts`)
  log(`   src/plugins/agents/${id}/plugin-manifest.json`)
  log('')
  log(`${c.bold}👉 下一步:${c.reset}`)
  log(`   1. ${c.cyan}npm run dev${c.reset}        → 启动开发服务器`)
  log(`   2. ${c.cyan}访问 /playground${c.reset}    → 测试你的 Agent`)
  log(`   3. 编辑 ${c.cyan}index.ts${c.reset}       → 实现你的分析逻辑`)
  log('')
  log(`${c.dim}📖 插件开发文档: src/plugins/README.md${c.reset}`)
  log(`${c.dim}📋 示范插件参考: src/plugins/agents/patent-scout/${c.reset}`)
  log('')

  rl.close()
}

main().catch((err) => {
  error(`脚手架运行失败: ${err.message}`)
  rl.close()
  process.exit(1)
})
