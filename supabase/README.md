# Supabase 마이그레이션

PLAN.md §4 스키마를 SQL로 옮긴 것입니다. **Supabase 프로젝트가 준비되면** 아래 순서대로 실행하세요.

## 실행 방법 (둘 중 하나)

### A. 대시보드 SQL Editor (가장 간단)
1. Supabase 대시보드 → **SQL Editor** 열기
2. `migrations/` 안의 파일을 **번호 순서대로** 복사·붙여넣기 후 실행
   - `0001_auth_rbac.sql` → `0002_match_tables.sql` → `0003_seed_roles_permissions.sql`

### B. Supabase CLI
```bash
# 최초 1회
npx supabase login
npx supabase link --project-ref <PROJECT_REF>

# 마이그레이션 적용
npx supabase db push
```

## 파일 구성
| 파일 | 내용 |
|------|------|
| `0001_auth_rbac.sql` | users / roles / user_roles / permissions / role_permissions |
| `0002_match_tables.sql` | sessions / matches / scores / summary_stats |
| `0003_seed_roles_permissions.sql` | 역할·권한 기본 데이터 (RBAC 매트릭스) |

## ✅ 인증 방식 (결정 완료, 2026-06-14)
**Supabase Auth** 사용으로 일원화.
- 인증·비밀번호·세션(JWT)은 `auth.users` 가 관리.
- `public.users` 는 **프로필 전용 테이블** — `id` 가 `auth.users(id)` 를 1:1 참조하며 `password` 컬럼은 제거됨.
- 회원가입: `supabase.auth.signUp()` → 성공 시 `users` 에 프로필 행 삽입(username/name/gender).
