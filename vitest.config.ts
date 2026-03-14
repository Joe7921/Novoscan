import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'path';

export default defineConfig({
  // 禁用 Vite 默认的 OXC 编译器 —— 源文件中部分中文字符编码不完整，
  // OXC 严格模式会报 'Unterminated string'；SWC（Next.js 同款）可正常处理
  oxc: false as any,
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', tsx: true },
        target: 'es2022',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/agents/qualityGuard.ts',
        'src/agents/orchestrator.ts',
        'src/agents/debater.ts',
        'src/agents/bizscan/quality-guard.ts',
        'src/lib/ai-client.ts',
      ],
      reporter: ['text', 'text-summary'],
    },
  },
});
