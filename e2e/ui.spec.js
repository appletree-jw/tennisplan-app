import { test, expect } from '@playwright/test'

// UI/UX 관통 테스트 (브라우저 렌더링·네비게이션·권한 게이팅·반응형)
// 데이터 변경이 없는 검증 위주 (데이터 흐름은 통합 테스트가 담당).

const ADMIN = { id: 'admin', pw: 'TennisAdmin2026!' }
const MEMBER = { id: 'testuser1', pw: 'test1234' }

async function login(page, id, pw) {
  await page.goto('/login')
  await page.getByLabel('아이디').fill(id)
  await page.getByLabel('비밀번호').fill(pw)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL('http://localhost:5173/')
}

test.describe('UI/UX', () => {
  test('TC1 게스트 홈 — 로그인/회원가입 랜딩', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '테니스 대진표' })).toBeVisible()
    await expect(page.locator('.home-actions').getByRole('link', { name: '로그인' })).toBeVisible()
    await expect(page.locator('.home-actions').getByRole('link', { name: '회원가입' })).toBeVisible()
  })

  test('TC2 member — 생성 불가, 목록/통계 랜딩 + 네비 게이팅', async ({ page }) => {
    await login(page, MEMBER.id, MEMBER.pw)
    // 생성기(참석자 패널) 안 보이고, 목록/통계 랜딩 노출
    await expect(page.locator('.home-actions').getByRole('link', { name: '대진표 목록' })).toBeVisible()
    await expect(page.getByText('대진 생성·수정은 관리자만')).toBeVisible()
    // 네비: 통계 보이고 관리자/대진추가 없음
    await expect(page.locator('.nav').getByRole('link', { name: '통계' })).toBeVisible()
    await expect(page.locator('.nav').getByRole('link', { name: '관리자', exact: true })).toHaveCount(0)
    await expect(page.locator('.nav').getByRole('link', { name: '대진 추가' })).toHaveCount(0)
  })

  test('TC3 admin — 네비에 대진추가/관리자, 생성기 노출', async ({ page }) => {
    await login(page, ADMIN.id, ADMIN.pw)
    await expect(page.locator('.nav').getByRole('link', { name: '대진 추가' })).toBeVisible()
    await expect(page.locator('.nav').getByRole('link', { name: '관리자', exact: true })).toBeVisible()
    // 생성 화면(참석자 패널)
    await expect(page.getByRole('heading', { name: /참석자/ })).toBeVisible()
    await expect(page.getByText('클럽원 선택')).toBeVisible()
  })

  test('TC4 admin — 대진 생성 렌더 (저장 안 함)', async ({ page }) => {
    await login(page, ADMIN.id, ADMIN.pw)
    // 게스트 6명 추가
    for (let i = 1; i <= 6; i++) {
      await page.getByPlaceholder('게스트 이름').fill(`E2E게스트${i}`)
      await page.getByRole('button', { name: '추가', exact: true }).click()
    }
    await page.getByRole('button', { name: '대진 생성' }).click()
    // 대진표 테이블 표시
    await expect(page.getByRole('columnheader', { name: '슬롯' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '3코트' })).toBeVisible()
    await expect(page.locator('.draw-table tbody tr').first()).toBeVisible()
  })

  test('TC5 admin — 통계 페이지 탭 전환', async ({ page }) => {
    await login(page, ADMIN.id, ADMIN.pw)
    await page.goto('/stats')
    await expect(page.getByRole('button', { name: '개인 승률' })).toBeVisible()
    await page.getByRole('button', { name: '페어 궁합' }).click()
    await expect(page.getByText('최소 경기')).toBeVisible()
  })

  test('TC7 내 정보 — 프로필/비밀번호 폼 렌더', async ({ page }) => {
    await login(page, MEMBER.id, MEMBER.pw)
    await page.locator('.nav').getByRole('link', { name: /님$/ }).click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByRole('heading', { name: '내 정보' })).toBeVisible()
    await expect(page.getByRole('button', { name: '프로필 저장' })).toBeVisible()
    await expect(page.getByRole('button', { name: '비밀번호 변경' })).toBeVisible()
  })

  test('TC6 반응형 — 모바일에서 가로 오버플로우 없음', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await login(page, ADMIN.id, ADMIN.pw)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(2) // 본문 가로 스크롤 없음 (표는 .capture 내부 스크롤)
  })
})
