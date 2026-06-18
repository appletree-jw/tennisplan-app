// =====================================================================
// drawGenerator.js
// 테니스 대진 생성 휴리스틱 엔진 — DRAW_RULES.md 전체 룰셋 구현
//
// 순수 함수: participants 배열을 받아 슬롯×코트 대진표를 반환한다.
// DB/네트워크 의존성 없음 → 클라이언트에서 즉시 실행·테스트 가능.
//
//   generateDraw({ participants, date, seed }) -> {
//     date, config, slots: [...], warnings: [...], stats: {...}, score, seed
//   }
//
// 하드룰(§3): 세트 균등(±1) > 슬롯 내 중복 금지 > 연속휴식 금지(≤2) > 성비 유형배분
// 소프트룰(§4): 페어중복 40 / 세트균등 25 / 연속휴식 20 / 코트균등 15
// 계산(§10): 우선순위 탐욕 배정 + 랜덤시드 다양성, 다회 반복 후 최적해 채택
// =====================================================================

import {
  START_TIME,
  COURTS,
  pickConfig,
  MATCH_TYPES,
  PREFERRED_COMBO_8,
  SINGLE_MATCH_TYPE,
  MAX_ITERATIONS,
  WEIGHTS,
} from './drawConfig.js'

// ---------------------------------------------------------------------
// 시드 기반 난수 (mulberry32) — 동일 시드 → 동일 대진표(재현/공유 목적)
// ---------------------------------------------------------------------
function makeRng(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(arr, rng) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const pairKey = (x, y) => [x, y].sort().join('|')

// 4코트가 실제로 한 번이라도 쓰였는지 (1코트 전용 대진 판별)
function usesBothCourts(courtCount) {
  return Object.values(courtCount).some((c) => c['4'] > 0)
}

// ---------------------------------------------------------------------
// 슬롯 시간 라벨 ("06:20", "06:50", ...)
// ---------------------------------------------------------------------
function slotTimes(slots, slotMinutes, startTime = START_TIME) {
  const [h0, m0] = startTime.split(':').map(Number)
  const out = []
  for (let i = 0; i < slots; i++) {
    const total = h0 * 60 + m0 + i * slotMinutes
    const h = Math.floor(total / 60) % 24
    const m = total % 60
    out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
  return out
}

// ---------------------------------------------------------------------
// 목표 세트 수 분배 — 총 출전횟수(=courtsUsed*4*slots)를 인원에 최대한 균등 배분
// 반환: { base, extras } → extras명이 base+1세트, 나머지가 base세트
// ---------------------------------------------------------------------
function computeSetTargets(playerSlotsTotal, n) {
  const base = Math.floor(playerSlotsTotal / n)
  const extras = playerSlotsTotal - base * n // base+1 을 받는 인원 수
  return { base, extras }
}

// 한 슬롯에서 사용할 코트 수 (인원이 8 미만이면 1코트)
function courtsForSlot(playingPoolSize) {
  return Math.min(COURTS.length, Math.floor(playingPoolSize / 4))
}

// ---------------------------------------------------------------------
// (f, m) 성비에 맞는 한 슬롯 유형 조합 선택 (8명 = 2경기 기준)
// PREFERRED_COMBO_8 우선, 없으면 feasible 조합 탐색.
// ---------------------------------------------------------------------
function pickTypeCombo(f) {
  const pref = PREFERRED_COMBO_8[f]
  if (pref) return pref
  // 일반 feasibility 탐색: 두 유형의 여자 합 == f
  const types = Object.keys(MATCH_TYPES)
  for (const t1 of types) {
    for (const t2 of types) {
      if (MATCH_TYPES[t1].female + MATCH_TYPES[t2].female === f) return [t1, t2]
    }
  }
  return null // 불가능 (예: f=7) → 호출부에서 다른 휴식 조합 재시도
}

// ---------------------------------------------------------------------
// 주어진 유형으로 실제 팀 구성 — femalesPool/malesPool에서 소비
// 반환: { type, teamA:[..], teamB:[..] } 또는 null(인원 부족)
// ---------------------------------------------------------------------
function buildMatch(type, females, males, rng) {
  const spec = MATCH_TYPES[type]
  if (females.length < spec.female || males.length < spec.male) return null
  const f = shuffle(females, rng)
  const m = shuffle(males, rng)
  let teamA, teamB
  switch (type) {
    case '혼복': // 남1여1 vs 남1여1
      teamA = [f[0], m[0]]
      teamB = [f[1], m[1]]
      break
    case '여복': // 여2 vs 여2
      teamA = [f[0], f[1]]
      teamB = [f[2], f[3]]
      break
    case '남복': // 남2 vs 남2
      teamA = [m[0], m[1]]
      teamB = [m[2], m[3]]
      break
    case '잡복': // (여1남1) vs 남2
      teamA = [f[0], m[0]]
      teamB = [m[1], m[2]]
      break
    default:
      return null
  }
  // 소비한 인원을 풀에서 제거
  const used = new Set([...teamA, ...teamB])
  removeUsed(females, used)
  removeUsed(males, used)
  return { type, teamA, teamB }
}

function removeUsed(pool, usedSet) {
  for (let i = pool.length - 1; i >= 0; i--) {
    if (usedSet.has(pool[i])) pool.splice(i, 1)
  }
}

// ---------------------------------------------------------------------
// 한 번의 대진표 시도 (탐욕 + 랜덤). 하드룰 위반 시 null 반환.
// ---------------------------------------------------------------------
function attemptDraw(participants, config, rng, startTime) {
  const names = participants.map((p) => p.name)
  const genderOf = Object.fromEntries(participants.map((p) => [p.name, p.gender]))
  const n = names.length

  const setsPlayed = Object.fromEntries(names.map((x) => [x, 0]))
  const restedLast = new Set() // 직전 슬롯에 쉰 인원
  const consecutiveRest = Object.fromEntries(names.map((x) => [x, 0]))
  const courtCount = Object.fromEntries(names.map((x) => [x, { 3: 0, 4: 0 }]))
  const pairCounts = {} // pairKey -> 회수

  const times = slotTimes(config.slots, config.slotMinutes, startTime)
  const slots = []
  let consecRestViolations = 0

  for (let s = 0; s < config.slots; s++) {
    const courtsUsed = courtsForSlot(n)
    const playingCount = courtsUsed * 4
    const restCount = n - playingCount

    // --- 휴식자 선택 (§3-3 연속휴식 금지 우선, 그다음 세트 많은 순) ---
    let resting = []
    if (restCount > 0) {
      // 연속휴식 금지: 직전에 쉰 사람은 가급적 제외
      const eligible = names.filter((x) => !restedLast.has(x))
      let candidates = eligible.slice()
      // 후보가 부족하면(불가피) restedLast 일부도 다시 쉬게 (≤2 연속 허용)
      if (candidates.length < restCount) {
        const extra = names.filter((x) => restedLast.has(x))
        candidates = candidates.concat(extra)
      }
      // 세트 많이 뛴 사람 우선 휴식 + 약간의 랜덤
      candidates = shuffle(candidates, rng).sort(
        (a, b) => setsPlayed[b] - setsPlayed[a],
      )
      resting = candidates.slice(0, restCount)
      // 2슬롯 연속 휴식 카운트
      for (const r of resting) {
        if (restedLast.has(r)) consecRestViolations++
      }
    }

    const restSet = new Set(resting)
    const playing = names.filter((x) => !restSet.has(x))

    // --- 유형 조합 결정 ---
    const females = playing.filter((x) => genderOf[x] === 'F')
    const males = playing.filter((x) => genderOf[x] === 'M')
    let types
    if (courtsUsed === 2) {
      types = pickTypeCombo(females.length)
      if (!types) return null // 이 휴식 구성으론 유형 배분 불가 → 재시도
    } else if (courtsUsed === 1) {
      const single = SINGLE_MATCH_TYPE[females.length]
      if (!single) return null
      types = [single]
    } else {
      return null // 4명 미만 — 대진 불가
    }

    // --- 팀 구성 ---
    const fPool = females.slice()
    const mPool = males.slice()
    const matches = []
    for (const t of types) {
      const match = buildMatch(t, fPool, mPool, rng)
      if (!match) return null
      matches.push(match)
    }

    // --- 코트 배정 (§9 균등 목표: 각자 3/4코트 절반) ---
    // 2코트면 두 매치를 어느 코트에 둘지 두 방향 중 코트 불균형이 작은 쪽 선택.
    let courtAssign = COURTS.slice(0, courtsUsed)
    if (courtsUsed === 2) {
      const imbalance = (assign) => {
        let total = 0
        matches.forEach((match, i) => {
          for (const name of [...match.teamA, ...match.teamB]) {
            const c = { ...courtCount[name] }
            c[assign[i]]++
            total += Math.abs(c['3'] - c['4'])
          }
        })
        return total
      }
      const flipped = [COURTS[1], COURTS[0]]
      const a = imbalance(COURTS)
      const b = imbalance(flipped)
      // 더 균등한 쪽, 동률이면 랜덤
      courtAssign = a < b || (a === b && rng() < 0.5) ? COURTS.slice() : flipped
    }
    const courts = {}
    matches.forEach((match, i) => {
      const court = courtAssign[i]
      courts[court] = match
      for (const name of [...match.teamA, ...match.teamB]) {
        courtCount[name][court]++
        setsPlayed[name]++
      }
      // 페어 카운트 (같은 팀 = 페어)
      pairCounts[pairKey(...match.teamA)] = (pairCounts[pairKey(...match.teamA)] || 0) + 1
      pairCounts[pairKey(...match.teamB)] = (pairCounts[pairKey(...match.teamB)] || 0) + 1
    })

    slots.push({ slotNo: s + 1, time: times[s], courts, resting })

    // 연속휴식 상태 갱신
    for (const x of names) {
      if (restSet.has(x)) consecutiveRest[x]++
      else consecutiveRest[x] = 0
    }
    restedLast.clear()
    resting.forEach((r) => restedLast.add(r))
  }

  return {
    slots,
    setsPlayed,
    courtCount,
    pairCounts,
    consecRestViolations,
    names,
  }
}

// ---------------------------------------------------------------------
// 소프트룰 점수 (높을수록 좋음 = 페널티의 음수)
// ---------------------------------------------------------------------
function scoreDraw(d, setTargets) {
  // 페어 중복: (회수-1) 합
  let pairPenalty = 0
  for (const k in d.pairCounts) {
    if (d.pairCounts[k] > 1) pairPenalty += d.pairCounts[k] - 1
  }

  // 세트 균등: 목표(base/base+1) 대비 편차
  const setsVals = Object.values(d.setsPlayed)
  const maxSet = Math.max(...setsVals)
  const minSet = Math.min(...setsVals)
  const setPenalty = Math.max(0, maxSet - minSet - (setTargets.extras > 0 ? 1 : 0))

  // 연속 휴식
  const restPenalty = d.consecRestViolations

  // 코트 균등: |3코트 - 4코트| 가 1 초과인 만큼.
  // 단, 4코트가 한 번도 안 쓰인 1코트 전용 대진에선 의미 없으므로 제외.
  let courtPenalty = 0
  if (usesBothCourts(d.courtCount)) {
    for (const name in d.courtCount) {
      const c = d.courtCount[name]
      courtPenalty += Math.max(0, Math.abs(c['3'] - c['4']) - 1)
    }
  }

  return -(
    WEIGHTS.pairRepeat * pairPenalty +
    WEIGHTS.setBalance * setPenalty +
    WEIGHTS.restConsecutive * restPenalty +
    WEIGHTS.courtBalance * courtPenalty
  )
}

// ---------------------------------------------------------------------
// 경고 메시지 생성 (§3-1, §3-3, §7, §9 — 불가피한 불균등 명시)
// ---------------------------------------------------------------------
function buildWarnings(d) {
  const warnings = []
  const setsVals = Object.values(d.setsPlayed)
  const maxSet = Math.max(...setsVals)
  const minSet = Math.min(...setsVals)
  if (maxSet !== minSet) {
    const less = d.names.filter((x) => d.setsPlayed[x] === minSet)
    warnings.push(
      `세트 수 불균등: ${minSet}세트 ${less.length}명 / ${maxSet}세트 ${
        setsVals.filter((v) => v === maxSet).length
      }명 — ${less.join(', ')} 이(가) 1세트 적습니다. (§3-1·§7)`,
    )
  }
  if (d.consecRestViolations > 0) {
    warnings.push(`2슬롯 연속 휴식 ${d.consecRestViolations}건 발생 (구조상 불가피, §3-3 최대 허용).`)
  }
  if (usesBothCourts(d.courtCount)) {
    for (const name in d.courtCount) {
      const c = d.courtCount[name]
      if (Math.abs(c['3'] - c['4']) >= 2) {
        warnings.push(`코트 배분 불균등: ${name} (3코트 ${c['3']}·4코트 ${c['4']}) (§9).`)
      }
    }
  }
  return warnings
}

// ---------------------------------------------------------------------
// 공개 API: 여러 번 시도 후 최적 대진표 반환
// ---------------------------------------------------------------------
export function generateDraw({
  participants,
  date,
  seed,
  startTime = START_TIME,
  iterations = MAX_ITERATIONS,
}) {
  if (!participants || participants.length < 4) {
    throw new Error('대진 생성에는 최소 4명이 필요합니다.')
  }
  // 이름 중복 검사
  const nameSet = new Set(participants.map((p) => p.name))
  if (nameSet.size !== participants.length) {
    throw new Error('참석자 이름이 중복됩니다.')
  }

  const n = participants.length
  const config = pickConfig(n)
  const courtsUsed = courtsForSlot(n)
  const playerSlotsTotal = courtsUsed * 4 * config.slots
  const setTargets = computeSetTargets(playerSlotsTotal, n)

  const baseSeed = Number.isFinite(seed) ? seed >>> 0 : Math.floor(Math.random() * 0xffffffff)

  let best = null
  let bestScore = -Infinity
  for (let i = 0; i < iterations; i++) {
    const rng = makeRng(baseSeed + i)
    const attempt = attemptDraw(participants, config, rng, startTime)
    if (!attempt) continue
    const sc = scoreDraw(attempt, setTargets)
    if (sc > bestScore) {
      bestScore = sc
      best = attempt
      if (sc === 0) break // 완벽 — 더 볼 필요 없음
    }
  }

  if (!best) {
    throw new Error(
      '주어진 인원 구성으로 룰을 만족하는 대진을 생성하지 못했습니다. 성비를 확인해 주세요.',
    )
  }

  return {
    date: date || null,
    config: { ...config, startTime },
    // 재생성을 위해 입력 참석자(이름·성별·게스트)를 스냅샷에 보관
    participants: participants.map((p) => ({
      name: p.name,
      gender: p.gender,
      isGuest: !!p.isGuest,
    })),
    seed: baseSeed,
    score: bestScore,
    slots: best.slots,
    warnings: buildWarnings(best),
    stats: {
      headcount: n,
      setTargets,
      setsPlayed: best.setsPlayed,
      courtCount: best.courtCount,
    },
  }
}
