// =====================================================================
// drawConfig.js
// 대진 생성 설정 상수 — DRAW_RULES.md §1, §2, §4 기준
// =====================================================================

export const START_TIME = '06:20' // §1 시작 시간 고정
export const COURTS = ['3', '4'] // §1 2코트 동시 진행

// §1 인원수별 슬롯/시간/게임 규칙
// 주의: 룰 테이블에 11명이 누락되어 있어 11명은 12명 그룹으로 처리한다.
export function pickConfig(headcount) {
  if (headcount <= 10) return { slots: 5, slotMinutes: 30, games: 6 }
  if (headcount <= 12) return { slots: 6, slotMinutes: 25, games: 5 } // 11~12명
  return { slots: 6, slotMinutes: 20, games: 4 } // 13명 이상
}

// §2 경기 유형 — 각 유형이 소비하는 성별 인원 (한 경기 = 4명)
// female: 여자 수, layout: 팀 구성 방식
export const MATCH_TYPES = {
  혼복: { female: 2, male: 2, color: '#e53935' }, // 남1여1 vs 남1여1 (빨강)
  여복: { female: 4, male: 0, color: '#8e24aa' }, // 여2 vs 여2 (보라)
  남복: { female: 0, male: 4, color: '#1e88e5' }, // 남2 vs 남2 (파랑)
  잡복: { female: 1, male: 3, color: '#fb8c00' }, // 여1+남3, (여1남1) vs 남2 (주황)
}

// §3-4 / §6 성비(여자 수) 기반 한 슬롯(2경기=8명) 유형 조합 선호도.
// 키: 플레이 풀의 여자 수, 값: 선호하는 유형 2개 조합.
// (8명 기준. 1코트(4명)만 돌릴 때는 generator가 별도 처리)
export const PREFERRED_COMBO_8 = {
  0: ['남복', '남복'],
  1: ['잡복', '남복'],
  2: ['혼복', '남복'], // 여2: 혼복 위주
  3: ['혼복', '잡복'], // 여3: 혼복 위주, 필요 시 잡복
  4: ['여복', '남복'], // 여4: 여복 포함 구성
  5: ['여복', '잡복'], // 여5: 여복 위주
  6: ['여복', '혼복'],
  7: null, // 클린 조합 불가 (여7남1) — generator가 다른 휴식 조합으로 재시도
  8: ['여복', '여복'],
}

// §4 한 경기(4명) 단독 슬롯용 — 여자 수별 단일 유형
export const SINGLE_MATCH_TYPE = {
  0: '남복',
  1: '잡복',
  2: '혼복',
  4: '여복',
}

// §10 휴리스틱 반복 횟수 (최대 10,000회). 각 시도는 매우 가벼워 기본 5000.
export const MAX_ITERATIONS = 5000

// §4 소프트룰 가중치
export const WEIGHTS = {
  pairRepeat: 0.4, // 페어 중복 최소화
  setBalance: 0.25, // 세트 수 균등
  restConsecutive: 0.2, // 연속 휴식 최소화
  courtBalance: 0.15, // 코트 배분 균등
}
