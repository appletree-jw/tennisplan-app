import { defineConfig, configDefaults } from 'vitest/config'

// 기본 테스트(npm test): 순수 단위 테스트만.
// 통합 테스트(네트워크 필요)와 Playwright e2e 스펙은 제외(각각 별도 러너로 실행).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/*.integration.test.*', 'e2e/**'],
  },
})
