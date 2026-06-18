import { defineConfig } from 'vitest/config'

// 통합/관통 테스트 (npm run test:integration): 실제 Supabase 백엔드 대상.
// publishable 키는 공개키(브라우저 노출 전제)라 여기 둬도 무방. RLS 로 보호됨.
export default defineConfig({
  test: {
    include: ['**/*.integration.test.*'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    sequence: { concurrent: false },
    env: {
      VITE_SUPABASE_URL: 'https://pkqqqklwzmwluiexfdhn.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_ui63ly6xuD0JxYLv6-uyZg_jBcS__W_',
    },
  },
})
