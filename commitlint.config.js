module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 类型必须为以下之一
    'type-enum': [2, 'always', [
      'feat',     // 新功能
      'fix',      // 修复 Bug
      'docs',     // 文档变更
      'style',    // 代码格式（不影响逻辑）
      'refactor', // 代码重构
      'perf',     // 性能优化
      'test',     // 测试相关
      'build',    // 构建/依赖变更
      'ci',       // CI 配置变更
      'chore',    // 杂项
      'revert',   // 回滚
    ]],
    // 标题不超过 100 字符
    'header-max-length': [2, 'always', 100],
  },
};
