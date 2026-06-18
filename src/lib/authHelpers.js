// 인증 보조 유틸 (컴포넌트 아님 — fast-refresh 분리 목적)

// 로그인 식별자(아이디)를 Supabase Auth 용 합성 이메일로 매핑.
// 주의: Supabase 는 .local/.app 등 일부 TLD 를 "유효하지 않은 이메일"로 거부한다.
//       실제 TLD(.com)를 써야 형식 검증을 통과한다. (Confirm email OFF 라 발송은 안 함)
// 실제 이메일 입력 방식으로 전환하려면 이 함수만 교체하면 된다.
export const AUTH_EMAIL_DOMAIN = 'tennisplan.com'

export function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`
}

// 비로그인(게스트) 기본 권한 (PLAN §3 매트릭스: draw:read 만)
export const GUEST_PERMISSIONS = ['draw:read']
