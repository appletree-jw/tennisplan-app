# 🎾 테니스 클럽 관리 앱 — TODO 리스트

> PLAN.md 분석 기반 (마지막 업데이트: 2026-06-13)
> 범례: ✅ 완료 · 🟡 진행 중 · ⬜ 예정

---

## Step 1. 환경 설정 ✅
- [x] Git 설정
- [x] 로컬 MCP 환경 구성
- [x] Supabase 프로젝트 생성
- [x] React 앱 초기화 (CRA 또는 Vite)

## Step 2. DB 마이그레이션 🟡 (SQL 작성 완료, 실행 대기)
> `supabase/migrations/` 에 SQL 작성 완료. Supabase 키 연결 후 실행 필요.

**인증/권한 테이블** — `0001_auth_rbac.sql` ✅ 작성
- [x] `users` (id, username, password, name, gender, is_active, created_at)
- [x] `roles` (id, name, description)
- [x] `user_roles` (user_id, role_id, granted_at) — 다대다 매핑
- [x] `permissions` (id, action)
- [x] `role_permissions` (role_id, permission_id)

**경기 관련 테이블** — `0002_match_tables.sql` ✅ 작성
- [x] `sessions` (id, date, total_slots, created_by, created_at)
- [x] `matches` (id, session_id, slot_no, court, match_type, team_a[], team_b[], created_at)
- [x] `scores` (id, match_id, score_a, score_b, winner, recorded_by)
- [x] `summary_stats` (user_id, total_games, wins, losses, win_rate, by_type(jsonb), recent_10(jsonb), updated_at)
- [x] 권한 데이터 시드 — `0003_seed_roles_permissions.sql` ✅ 작성

**남은 작업**
- [ ] Supabase 프로젝트 키를 `.env.local` 에 설정
- [ ] 마이그레이션 실제 실행 (대시보드 SQL Editor 또는 `supabase db push`)
- [ ] `users.password` vs Supabase Auth 인증 방식 결정 (supabase/README.md 참고)

## Step 3. 인증 구현 ⬜ (우선순위 2)
- [ ] 회원가입 (아이디·비번·이름·성별)
- [ ] 로그인 → JWT 발급 (Supabase Auth)
- [ ] 권한 미들웨어 (RBAC: admin / member / guest)
- [ ] guest 비로그인 읽기 전용 접근 처리

## Step 4. 대진표 기능 🟡 (우선순위 1 — 진행 중)
- [ ] 참석자 선택 UI
- [ ] 대진 생성 (기존 Claude 로직 이식) 🟡
- [ ] 대진표 이미지 출력
- [ ] 대진표 저장 + 공유 URL 생성 (우선순위 3, guest 접근용)

## Step 5. 스코어 입력 ⬜ (우선순위 4)
- [ ] 경기별 스코어 입력 UI
- [ ] 입력 시 `summary_stats` 자동 갱신 로직

## Step 6. 통계/분석 ⬜ (우선순위 5~6)
- [ ] 개인 승률 대시보드
- [ ] 페어 궁합(궁합 승률) 분석
- [ ] 능력치 등급 산출
- [ ] 능력치 기반 대진 밸런싱 (우선순위 6)

---

## 📌 별도 챙길 항목 (PLAN.md 분석 시 발견)
- [ ] **PLAN.md → 정식 마크다운으로 변환** — 현재 파일은 `.md` 확장자지만 실제로는 Word(.docx) 바이너리. Claude가 토큰 절약하며 읽기 어려움. 순수 텍스트 `.md`로 다시 저장 권장.
- [ ] **`DB_SCHEMA.md` 파일 생성** — PLAN.md의 협업 방식(§8)에서 `DB_SCHEMA.md`를 참조하지만 폴더에 아직 없음. DB 스키마를 별도 파일로 분리.
- [ ] 배포 환경 확정 (Vercel vs GitHub Pages — Vercel 권장: SPA/서버리스 지원)
- [ ] 비밀번호 `bcrypt` 해싱 vs Supabase Auth 내장 인증 중 방식 일원화 (스키마엔 password 컬럼, 스택엔 Supabase Auth — 중복 설계 점검 필요)
