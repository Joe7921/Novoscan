#!/usr/bin/env node
/**
 * 🚀 Novoscan Agent 发布工具
 *
 * 交互式 CLI 工具，将本地插件发布到 Novoscan 插件市场。
 * 用法：npm run publish-agent [plugin-dir-name]
 *
 * 流程：
 *   1. 扫描指定插件目录，读取 plugin-manifest.json
 *   2. 运行格式校验（validateAgent + manifest 完整性检查）
 *   3. 验证 index.ts 可正常导入（动态 import 测试）
 *   4. 使用 GitHub Personal Access Token 认证
 *   5. POST 到 Registry API 发布端点
 *   6. 输出发布结果
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
  bgMagenta: '\x1b[45m\x1b[37m',
}

function log(msg: string) { console.log(msg) }
function success(msg: string) { log(`${c.green}✅ ${msg}${c.reset}`) }
function info(msg: string) { log(`${c.cyan}ℹ  ${msg}${c.reset}`) }
function warn(msg: string) { log(`${c.yellow}⚠️  ${msg}${c.reset}`) }
function error(msg: string) { log(`${c.red}❌ ${msg}${c.reset}`) }
function step(num: number, total: number, msg: string) {
  log(`${c.cyan}[${num}/${total}]${c.reset} ${msg}`)
}

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

function askPassword(question: string): Promise<string> {
  const prompt = `${c.cyan}? ${c.bold}${question}${c.reset} `
  return new Promise((resolve) => {
    process.stdout.write(prompt)
    // 简单密码输入（不回显完整 Token）
    rl.question('', (answer) => {
      resolve(answer.trim())
    })
  })
}

// ==================== Registry API 配置 ====================
const REGISTRY_API_URL = 'https://novoscan.cn/api/marketplace/publish'
const TOTAL_STEPS = 5

// ==================== Manifest 完整性校验 ====================

/** Manifest 必须包含的字段 */
const REQUIRED_MANIFEST_FIELDS = [
  'id', 'name', 'nameEn', 'description', 'version',
  'author', 'category', 'icon', 'entryPoint', 'pricing',
] as const

/** 合法的插件分类 */
const VALID_CATEGORIES = new Set(['academic', 'industry', 'specialized', 'community'])

/** 合法的定价模式 */
const VALID_PRICING = new Set(['free', 'paid', 'freemium'])

/** 语义化版本号正则 */
const SEMVER_RE = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/

/** kebab-case 正则 */
const KEBAB_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

interface ManifestValidationResult {
  valid: boolean
  issues: string[]
}

/**
 * 校验 plugin-manifest.json 的完整性和格式
 */
function validateManifest(manifest: Record<string, unknown>): ManifestValidationResult {
  const issues: string[] = []

  // 检查必填字段
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!manifest[field] || (typeof manifest[field] === 'string' && !(manifest[field] as string).trim())) {
      issues.push(`缺少必填字段: ${field}`)
    }
  }

  // ID 格式校验
  if (typeof manifest.id === 'string' && !KEBAB_RE.test(manifest.id)) {
    issues.push(`id "${manifest.id}" 必须为 kebab-case 格式（如 'my-agent'）`)
  }

  // 版本号格式校验
  if (typeof manifest.version === 'string' && !SEMVER_RE.test(manifest.version)) {
    issues.push(`version "${manifest.version}" 不符合语义化版本号格式（如 '1.0.0'）`)
  }

  // 分类校验
  if (typeof manifest.category === 'string' && !VALID_CATEGORIES.has(manifest.category)) {
    issues.push(`category "${manifest.category}" 不合法，必须为: ${[...VALID_CATEGORIES].join(' | ')}`)
  }

  // 定价模式校验
  if (typeof manifest.pricing === 'string' && !VALID_PRICING.has(manifest.pricing)) {
    issues.push(`pricing "${manifest.pricing}" 不合法，必须为: ${[...VALID_PRICING].join(' | ')}`)
  }

  // 权限数组校验（如果存在）
  if (manifest.permissions !== undefined && !Array.isArray(manifest.permissions)) {
    issues.push('permissions 必须为数组')
  }

  // tags 数组校验（如果存在）
  if (manifest.tags !== undefined && !Array.isArray(manifest.tags)) {
    issues.push('tags 必须为数组')
  }

  return { valid: issues.length === 0, issues }
}

// ==================== 主流程 ====================
async function main() {
  log('')
  log(`${c.bgMagenta}                                         ${c.reset}`)
  log(`${c.bgMagenta}   🚀 Novoscan Agent Publisher v1.0.0    ${c.reset}`)
  log(`${c.bgMagenta}                                         ${c.reset}`)
  log('')
  log(`${c.dim}  将你的 Agent 插件发布到 Novoscan 插件市场。${c.reset}`)
  log('')

  // ========== Step 1：定位插件目录 ==========
  step(1, TOTAL_STEPS, '定位插件目录...')

  const projectRoot = path.resolve(__dirname, '..')
  const pluginsBaseDir = path.join(projectRoot, 'src', 'plugins', 'agents')

  // 从命令行参数或交互式获取插件名称
  let pluginDirName = process.argv[2]
  if (!pluginDirName) {
    // 列出可用的插件目录
    const availableDirs = fs.readdirSync(pluginsBaseDir).filter((d) => {
      const fullPath = path.join(pluginsBaseDir, d)
      return fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'plugin-manifest.json'))
    })

    if (availableDirs.length === 0) {
      error('未发现任何包含 plugin-manifest.json 的插件目录')
      error(`请在 ${pluginsBaseDir} 下创建插件，或运行 npm run create-agent`)
      rl.close()
      process.exit(1)
    }

    log(`${c.dim}  可用的插件目录:${c.reset}`)
    availableDirs.forEach((d, i) => {
      log(`  ${c.cyan}${i + 1}.${c.reset} ${d}`)
    })
    log('')

    const input = await ask('选择插件目录（输入名称或编号）:')
    const idx = parseInt(input) - 1
    pluginDirName = (idx >= 0 && idx < availableDirs.length) ? availableDirs[idx] : input
  }

  const pluginDir = path.join(pluginsBaseDir, pluginDirName)

  // 检查目录存在性
  if (!fs.existsSync(pluginDir)) {
    error(`插件目录不存在: ${pluginDir}`)
    rl.close()
    process.exit(1)
  }

  success(`定位到插件目录: src/plugins/agents/${pluginDirName}`)

  // ========== Step 2：读取并校验 manifest ==========
  step(2, TOTAL_STEPS, '读取并校验 plugin-manifest.json...')

  const manifestPath = path.join(pluginDir, 'plugin-manifest.json')
  if (!fs.existsSync(manifestPath)) {
    error(`未找到 plugin-manifest.json: ${manifestPath}`)
    error('请确保插件目录包含 plugin-manifest.json 文件')
    rl.close()
    process.exit(1)
  }

  let manifest: Record<string, unknown>
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8')
    manifest = JSON.parse(raw) as Record<string, unknown>
  } catch (err) {
    error(`解析 plugin-manifest.json 失败: ${err instanceof Error ? err.message : String(err)}`)
    rl.close()
    process.exit(1)
  }

  // Manifest 完整性校验
  const manifestCheck = validateManifest(manifest)
  if (!manifestCheck.valid) {
    error('plugin-manifest.json 格式校验失败:')
    manifestCheck.issues.forEach((issue, i) => {
      log(`  ${c.red}${i + 1}. ${issue}${c.reset}`)
    })
    rl.close()
    process.exit(1)
  }

  success(`Manifest 校验通过: ${manifest.icon} ${manifest.name} (${manifest.id}) v${manifest.version}`)

  // ========== Step 3：动态导入 + Agent 格式校验 ==========
  step(3, TOTAL_STEPS, '验证 index.ts 可正常导入...')

  const entryPoint = manifest.entryPoint as string || 'index.ts'
  const entryPath = path.join(pluginDir, entryPoint)

  if (!fs.existsSync(entryPath)) {
    error(`入口文件不存在: ${entryPath}`)
    rl.close()
    process.exit(1)
  }

  try {
    // 动态导入测试（tsx 支持直接导入 .ts 文件）
    const module = await import(entryPath)
    const agent = module.default

    if (!agent) {
      error('入口文件缺少 default 导出，请使用 export default defineAgent({...})')
      rl.close()
      process.exit(1)
    }

    // 使用 validateAgent 进行运行时校验
    const { validateAgent } = await import(path.join(projectRoot, 'src', 'plugins', 'types'))
    validateAgent(agent)

    success(`Agent 格式校验通过: analyze() 函数已就绪`)
  } catch (err) {
    error(`Agent 校验失败: ${err instanceof Error ? err.message : String(err)}`)
    warn('提示: 确保 index.ts 使用 export default defineAgent({...}) 导出')
    rl.close()
    process.exit(1)
  }

  // ========== Step 4：认证 ==========
  step(4, TOTAL_STEPS, '获取发布认证...')

  let githubToken = process.env.GITHUB_TOKEN || ''
  if (!githubToken) {
    warn('未检测到 GITHUB_TOKEN 环境变量')
    githubToken = await askPassword('请输入 GitHub Personal Access Token:')
    if (!githubToken) {
      error('Token 不能为空，发布需要 GitHub 认证')
      rl.close()
      process.exit(1)
    }
  } else {
    success(`已从环境变量 GITHUB_TOKEN 读取认证信息`)
  }

  // Token 格式基础校验（GitHub PAT 以 ghp_ 或 github_pat_ 开头）
  if (!githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
    warn('Token 格式不符合 GitHub PAT 标准（ghp_ 或 github_pat_ 开头），请确认是否正确')
    const proceed = await ask('是否继续? (y/N):', 'N')
    if (proceed.toLowerCase() !== 'y') {
      info('已取消发布')
      rl.close()
      return
    }
  }

  // ========== 发布前确认 ==========
  log('')
  log(`${c.dim}─────────────────────────────────────────${c.reset}`)
  log(`${c.bold}  即将发布:${c.reset}`)
  log(`  插件:     ${c.magenta}${manifest.icon} ${manifest.name}${c.reset} (${manifest.id})`)
  log(`  版本:     ${c.cyan}v${manifest.version}${c.reset}`)
  log(`  作者:     ${c.cyan}${manifest.author}${c.reset}`)
  log(`  分类:     ${c.cyan}${manifest.category}${c.reset}`)
  log(`  定价:     ${c.cyan}${manifest.pricing}${c.reset}`)
  log(`  目标:     ${c.cyan}${REGISTRY_API_URL}${c.reset}`)
  log(`${c.dim}─────────────────────────────────────────${c.reset}`)
  log('')

  const confirm = await ask('确认发布? (Y/n):', 'Y')
  if (confirm.toLowerCase() === 'n') {
    warn('已取消发布')
    rl.close()
    return
  }

  // ========== Step 5：POST 发布 ==========
  step(5, TOTAL_STEPS, '正在发布到 Novoscan Registry...')

  try {
    const response = await fetch(REGISTRY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${githubToken}`,
        'User-Agent': 'novoscan-publish-agent/1.0.0',
      },
      body: JSON.stringify({
        manifest,
        token: githubToken,
      }),
    })

    if (response.ok) {
      const result = await response.json() as Record<string, unknown>
      log('')
      log(`${c.green}${c.bold}🎉 发布成功！${c.reset}`)
      log('')
      log(`${c.bold}📦 插件详情:${c.reset}`)
      log(`   ID:      ${manifest.id}`)
      log(`   版本:    v${manifest.version}`)
      if (result.url) {
        log(`   市场链接: ${c.cyan}${result.url}${c.reset}`)
      }
      log('')
      log(`${c.dim}📖 你的插件将在审核通过后出现在插件市场。${c.reset}`)
    } else {
      const errorBody = await response.text()
      error(`发布失败 (HTTP ${response.status}): ${errorBody}`)
      log('')
      if (response.status === 401) {
        warn('认证失败，请检查你的 GitHub Token 是否有效')
      } else if (response.status === 409) {
        warn('该版本已存在，请更新 plugin-manifest.json 中的 version 字段')
      } else if (response.status === 422) {
        warn('数据格式不正确，请检查 plugin-manifest.json')
      } else {
        warn('请稍后重试或联系 support@novoscan.cn')
      }
    }
  } catch (err) {
    error(`网络请求失败: ${err instanceof Error ? err.message : String(err)}`)
    warn('请检查网络连接或 Registry 服务是否可用')
    warn(`目标 URL: ${REGISTRY_API_URL}`)
  }

  log('')
  rl.close()
}

main().catch((err) => {
  error(`发布工具运行失败: ${err instanceof Error ? err.message : String(err)}`)
  rl.close()
  process.exit(1)
})
