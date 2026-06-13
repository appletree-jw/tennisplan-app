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

## ⚠️ 설계 확인 필요 (TODO.md 참고)
`users` 테이블에 `password` 컬럼이 있는데, 기술스택은 **Supabase Auth** 사용입니다.
- **방식 1:** Supabase Auth(`auth.users`)로 인증 → 이 `users`는 프로필 테이블로만 사용, `password` 컬럼 제거
- **방식 2:** 자체 인증 → `password`에 bcrypt 해시 저장

둘 중 하나로 정해야 합니다. (Step 3 인증 구현 전 결정 권장)
