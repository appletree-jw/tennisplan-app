// 표시용 라벨 매핑 (여러 화면에서 공용)

// 성별 → 한글 (미지정은 '?')
export function genderLabel(gender) {
  return gender === 'F' ? '여' : gender === 'M' ? '남' : '?'
}

// 승자(enum) → 한글 ('A'/'B'/'draw')
export function winnerLabel(winner) {
  return winner === 'draw' ? '무' : `${winner}팀 승`
}
