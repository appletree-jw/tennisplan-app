import { defineConfig, configDefaults } from 'vitest/config'

// 기본 테스트(npm test): 순수 단위 테스트만. 통합 테스트는 제외(네트워크 필요).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/*.integration.test.*'],
  },
})
