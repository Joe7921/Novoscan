/**
 * 类型兼容层 — 原 src/types.ts
 *
 * 所有类型已迁移至 src/types/ 目录的子模块。
 * 本文件仅做 re-export，确保所有 `import { ... } from '@/types'` 继续正常工作。
 *
 * ⚠️ 此文件由 Next.js 的 tsconfig paths 解析为 '@/types' 时，
 * 会优先匹配为文件而非目录。但由于 tsconfig 的 paths 中
 * '@/*' 映射到 './src/*'，import '@/types' 会先尝试 './src/types.ts'，
 * 如果不存在则尝试 './src/types/index.ts'。
 *
 * 为确保平滑过渡，本文件保留并 re-export 所有内容。
 * 未来可以直接删除此文件，让 TypeScript 自然回落到 src/types/index.ts。
 */

// 全量 re-export 新的类型目录
export * from './types/index';