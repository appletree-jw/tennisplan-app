// =====================================================================
// drawGenerator.test.js — 대진 생성 엔진 룰 검증 (DRAW_RULES.md 대응)
// =====================================================================
import { describe, it, expect } from 'vitest'
import { generateDraw } from './drawGenerator.js'
import { MATCH_TYPES } from './drawConfig.js'

// --- 테스트용 로스터 생성 ---
function roster(males, females) {
  const p = []
  for (let i = 1; i <= males; i++) p.push({ name: `남${i}`, gender: 'M' })
  for (let i = 1; i <= females; i++) p.push({ name: `여${i}`, gender: 'F' })
  return p
}

// 빠른 테스트를 위해 반복 횟수 축소 (정확성에는 영향 없음)
const gen = (males, females, seed = 1) =>
  generateDraw({ participants: roster(males, females), date: '2026-06-15', seed, iterations: 800 })

// 다양한 성비/인원 조합 (실제 클럽 시나리오)
const ROSTERS = [
  [9, 4], [10, 3], [8, 4], [6, 2], [11, 2], [7, 3], [12, 0], [5, 3], [4, 0], [10, 5],
]

function genderMap(males, females) {
  const m = {}
  roster(males, females).forEach((p) => (m[p.name] = p.gender))
  return m
}

function allMatches(draw) {
  return draw.slots.flatMap((s) => Object.values(s.courts))
}

describe('§1 인원별 설정 (pickConfig)', () => {
  it('10명 이하 → 5슬롯/30분/6게임', () => {
    expect(gen(6, 4).config).toMatchObject({ slots: 5, slotMinutes: 30, games: 6 })
  })
  it('11~12명 → 6슬롯/25분/5게임 (11명은 12명 그룹으로 처리)', () => {
    expect(gen(9, 2).config).toMatchObject({ slots: 6, slotMinutes: 25, games: 5 }) // 11명
    expect(gen(8, 4).config).toMatchObject({ slots: 6, slotMinutes: 25, games: 5 }) // 12명
  })
  it('13명 이상 → 6슬롯/20분/4게임', () => {
    expect(gen(9, 4).config).toMatchObject({ slots: 6, slotMinutes: 20, games: 4 }) // 13명
  })
  it('첫 슬롯은 06:20 시작 (기본값)', () => {
    expect(gen(8, 4).slots[0].time).toBe('06:20')
  })
  it('시작 시간 지정 가능 (07:00 → 슬롯 간격 반영)', () => {
    const d = generateDraw({
      participants: roster(6, 2),
      startTime: '07:00',
      iterations: 200,
    })
    expect(d.slots[0].time).toBe('07:00')
    expect(d.slots[1].time).toBe('07:30') // 30분 간격(8명)
    expect(d.config.startTime).toBe('07:00')
  })
})

describe('§3-2 슬롯 내 중복 금지', () => {
  it('한 슬롯에서 플레이/휴식 인원이 서로소이고 중복이 없다', () => {
    for (const [m, f] of ROSTERS) {
      const draw = gen(m, f)
      for (const slot of draw.slots) {
        const playing = Object.values(slot.courts).flatMap((mt) => [...mt.teamA, ...mt.teamB])
        const rest = slot.resting
        expect(new Set(playing).size).toBe(playing.length) // 플레이 중복 없음
        expect(playing.filter((x) => rest.includes(x))).toEqual([]) // 휴식과 겹치지 않음
        expect(new Set([...playing, ...rest]).size).toBe(m + f) // 전원이 정확히 한 번 등장
      }
    }
  })
})

describe('§3-1 / §7 세트 수 균등', () => {
  it('모든 인원의 세트 수 차이는 최대 1', () => {
    for (const [m, f] of ROSTERS) {
      const sets = Object.values(gen(m, f).stats.setsPlayed)
      expect(Math.max(...sets) - Math.min(...sets)).toBeLessThanOrEqual(1)
    }
  })
  it('13명 → 3세트 4명 / 4세트 9명 (룰 §7 명시값)', () => {
    const sets = Object.values(gen(9, 4).stats.setsPlayed)
    expect(sets.filter((v) => v === 3).length).toBe(4)
    expect(sets.filter((v) => v === 4).length).toBe(9)
  })
})

describe('§3-3 연속 휴식 금지', () => {
  it('3슬롯 연속 휴식자가 없다 (최대 2까지만 허용)', () => {
    for (const [m, f] of ROSTERS) {
      const draw = gen(m, f)
      const names = roster(m, f).map((p) => p.name)
      for (const name of names) {
        let streak = 0
        for (const slot of draw.slots) {
          streak = slot.resting.includes(name) ? streak + 1 : 0
          expect(streak).toBeLessThanOrEqual(2)
        }
      }
    }
  })
})

describe('§2 경기 유형 구성 검증', () => {
  it('각 매치는 유형별 성별 구성을 정확히 따른다', () => {
    for (const [m, f] of ROSTERS) {
      const gm = genderMap(m, f)
      const draw = gen(m, f)
      for (const match of allMatches(draw)) {
        const players = [...match.teamA, ...match.teamB]
        expect(match.teamA).toHaveLength(2)
        expect(match.teamB).toHaveLength(2)
        const fc = players.filter((p) => gm[p] === 'F').length
        const mc = players.filter((p) => gm[p] === 'M').length
        const spec = MATCH_TYPES[match.type]
        expect(spec).toBeDefined()
        expect(fc).toBe(spec.female)
        expect(mc).toBe(spec.male)
        if (match.type === '혼복') {
          // 각 팀 1여1남
          expect(match.teamA.filter((p) => gm[p] === 'F')).toHaveLength(1)
          expect(match.teamB.filter((p) => gm[p] === 'F')).toHaveLength(1)
        }
      }
    }
  })

  it('여자 없는 로스터엔 남복만 편성된다', () => {
    for (const match of allMatches(gen(12, 0))) {
      expect(match.type).toBe('남복')
    }
  })
})

describe('§9 코트 유효성', () => {
  it('코트 키는 3/4 뿐이고 사용된 코트엔 매치가 있다', () => {
    for (const [m, f] of ROSTERS) {
      for (const slot of gen(m, f).slots) {
        for (const court of Object.keys(slot.courts)) {
          expect(['3', '4']).toContain(court)
          expect(slot.courts[court]).toBeTruthy()
        }
      }
    }
  })
})

describe('§10 결정론 (시드 재현성)', () => {
  it('같은 시드 → 동일한 대진표', () => {
    expect(gen(9, 4, 42)).toEqual(gen(9, 4, 42))
  })
  it('seed 를 result.seed 로 다시 넣으면 동일 결과', () => {
    const first = gen(9, 4, 7)
    const again = generateDraw({
      participants: roster(9, 4),
      date: '2026-06-15',
      seed: first.seed,
      iterations: 800,
    })
    expect(again.slots).toEqual(first.slots)
  })
})

describe('입력 검증', () => {
  it('4명 미만이면 에러', () => {
    expect(() => gen(2, 1)).toThrow(/최소 4명/)
  })
  it('이름 중복이면 에러', () => {
    expect(() =>
      generateDraw({
        participants: [
          { name: '철수', gender: 'M' },
          { name: '철수', gender: 'M' },
          { name: '영희', gender: 'F' },
          { name: '민수', gender: 'M' },
        ],
      }),
    ).toThrow(/중복/)
  })
})
