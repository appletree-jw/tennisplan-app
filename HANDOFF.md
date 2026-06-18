# 🎾 테니스 클럽 앱 — 작업 핸드오프

> 다음 세션에서 이어가기 위한 진행 상황 문서
> 마지막 업데이트: 2026-06-14

---

## 1. 한눈에 보기 (현재 위치)

| Step | 상태 | 비고 |
|------|------|------|
| Step 1. 환경 설정 | ✅ 완료 | Vite + React + Supabase |
| Step 2. DB 마이그레이션 | ✅ **실행 완료** | 0001~0004, 테이블9+RLS+트리거+시드 검증 |
| Step 3. 인증 구현 | ✅ **E2E 검증 완료** | 가입→로그인→프로필/역할 자동생성 확인 |
| **Step 4. 대진표 기능** | ✅ **완료** | 생성·이미지·저장/공유 URL 전부 동작 |
| Step 5. 스코어 입력 | ✅ **E2E 검증 완료** | 입력→트리거→이름기준 summary_stats 갱신 |
| Step 6. 통계/분석 | ⬜ 다음 | summary_stats(이름 기준) 읽어 대시보드 |

**진행 원칙(합의된 순서):** 인증방식 결정 → 대진생성(DB 불필요) → DB 마이그레이션 실행 → 인증 → 저장/공유·스코어·통계

---

## 2. 이번 세션에서 한 일

### (1) 인증 방식 결정 → **Supabase Auth** 채택
- `auth.users` 가 인증·비밀번호·세션(JWT) 관리.
- `public.users` 는 **프로필 전용** 테이블 — `id` 가 `auth.users(id)` 를 1:1 참조, `password` 컬럼 **제거**.
- 회원가입 흐름(예정): `supabase.auth.signUp()` 성공 → `users` 에 프로필 행(username/name/gender) 삽입.
- **반영 위치:** `supabase/migrations/0001_auth_rbac.sql`, `supabase/README.md`, `TODO.md`

### (2) 대진 생성 엔진 + 참석자 UI (DRAW_RULES.md 룰셋 구현) — **DB 불필요**
- 우선순위 1 기능의 핵심. 브라우저에서 즉시 동작.

---

## 3. 파일 맵 (이번 세션 신규/수정)

```
src/
├── App.jsx                  # ✏️ 참석자 입력 UI + 대진표 출력 (Vite 템플릿 → 교체)
├── App.css                  # ✏️ 스타일 전면 교체
└── lib/
    ├── drawConfig.js        # 🆕 룰셋 상수 (인원별 슬롯/유형/성비조합/가중치)
    └── drawGenerator.js     # 🆕 휴리스틱 대진 생성 엔진 (순수 함수)

supabase/migrations/
└── 0001_auth_rbac.sql       # ✏️ users 를 auth.users 프로필로 변경, password 제거

DRAW_RULES.md                # (입력) 대진 룰셋 — 엔진의 스펙 원본
HANDOFF.md                   # 🆕 이 문서
docs/sessions/*.jsonl        # 🆕 세션 대화 기록 백업
```

---

## 4. 대진 생성 엔진 설계 요약 (`src/lib/drawGenerator.js`)

**공개 API**
```js
import { generateDraw } from './lib/drawGenerator.js'

const result = generateDraw({
  participants: [{ name, gender: 'M'|'F', isGuest }],
  date: '2026-06-15',
  seed,          // 선택. 같은 시드 → 같은 대진표(재현/공유용)
  iterations,    // 선택. 기본 5000
})
// result = { date, config, seed, score, slots[], warnings[], stats }
```

**룰 구현 (DRAW_RULES.md 대응)**
- §1 인원별 슬롯/시간/게임: `pickConfig()` — ≤10명 5슬롯, 11~12명 6슬롯/25분, 13명+ 6슬롯/20분
- §2 유형: 혼복/여복/남복/잡복 (`MATCH_TYPES`), 잡복 = (여1남1) vs 남2
- §3 하드룰(우선순위): 세트균등(±1) → 슬롯내 중복금지 → 연속휴식금지(≤2) → 성비 유형배분
- §3-4/§6 성비 조합: `PREFERRED_COMBO_8` (플레이 풀 여자 수별 2경기 유형)
- §4 소프트룰 가중치: 페어40 / 세트25 / 휴식20 / 코트15 (`WEIGHTS`, `scoreDraw()`)
- §9 코트균등: 슬롯마다 불균형 작은 배치 선택 + 점수 반영
- §10 휴리스틱: 시드 PRNG(mulberry32) 기반 최대 5000회 반복, 최고점 채택
- 불가피한 불균등(§3-1/§7/§9)은 `warnings[]` 로 명시 출력

**검증 결과:** `src/lib/drawGenerator.test.js` (vitest, **15 케이스 통과**) — 10종 로스터에 대해 슬롯내 중복금지·세트균등(±1)·연속휴식금지(≤2)·유형별 성별구성·코트유효성·시드 결정론·입력검증을 모두 검사. 특히 **13명 → 3세트 4명·4세트 9명** 이 §7 명시값과 정확히 일치함을 단언.

```bash
npm test          # 1회 실행
npm run test:watch
```

---

## 5. 적용된 가정 / 미구현 (확인 필요)

- ⚠️ **11명 누락**: 룰 테이블에 11명 행이 없어 12명 그룹(6슬롯/25분/5게임)으로 처리. → 다르면 `drawConfig.pickConfig()` 수정.
- ⚠️ **§6 특정 인원 고정 규칙**("승현·정미 고정 여복", "주희 잡복 제외")은 일반 엔진에서 **미반영**. 추후 선택적 입력(고정페어/잡복 제외·허용 플래그)으로 추가 가능.
- ✅ **대진표 이미지(PNG) 출력**(§11): `html-to-image`로 결과 패널 캡처 → 다운로드. (다크 테마로 캡처)
- ✅ **UI 다크모드**: `index.css`·`App.css` 다크 팔레트 적용.
- ⬜ **공유 URL / 저장**: DB 필요(Step 4 후반, 우선순위 3).

---

## 6. 실행 방법

```bash
npm install        # 최초 1회
npm run dev        # http://localhost:5173/
npm run build      # 프로덕션 빌드 (통과 확인됨)
npm run lint       # ESLint (통과 확인됨)
```

엔진 단독 테스트(노드):
```bash
node -e "import('./src/lib/drawGenerator.js').then(({generateDraw})=>{ \
  const p=[...Array(9)].map((_,i)=>({name:'남'+(i+1),gender:'M'})) \
    .concat([...Array(4)].map((_,i)=>({name:'여'+(i+1),gender:'F'}))); \
  console.log(JSON.stringify(generateDraw({participants:p,date:'2026-06-15',seed:42}),null,2)); })"
```

---

## 7. 다음에 할 일 (우선순위 순)

1. **브라우저 동작 확인** — `npm run dev` 후 참석자 추가 → "대진 생성" 클릭.
2. **DB 마이그레이션 실행 (Step 2 마무리)** — Supabase 키를 `.env.local` 에 넣고 SQL Editor 또는 `npx supabase db push`. (키 필요)
   - `.env.example` 참고. `0001 → 0002 → 0003` 순서.
3. **대진표 PNG 이미지 출력 (§11)** — DB 불필요, 우선순위 1의 남은 부분. `html-to-image`/`dom-to-image` 등으로 테이블 캡처.
4. **인증 구현 (Step 3)** — Supabase Auth 회원가입/로그인 + RBAC 미들웨어 (DB·키 필요).
5. **대진표 저장 + 공유 URL** (우선순위 3) → **스코어 입력**(Step 5) → **통계**(Step 6).

### 미해결 질문 (다음 세션에서 물어볼 것)
- 11명 처리 방식이 맞는지?
- §6 특정 인원 고정 규칙을 엔진에 넣을지, 넣는다면 입력 UI를 어떻게?
- 배포 대상 확정(Vercel 권장).

---

## 7-A. Step 3 인증 — 구조 & 활성화 체크리스트

**추가된 파일**
```
src/lib/auth.jsx          # AuthProvider + useAuth (세션/프로필/권한, signUp·signIn·signOut·hasPermission)
src/lib/authHelpers.js    # usernameToEmail(아이디→합성이메일), GUEST_PERMISSIONS
src/pages/DrawPage.jsx    # 기존 대진 UI (App.jsx에서 분리)
src/pages/LoginPage.jsx   # 로그인 (아이디/비번)
src/pages/SignupPage.jsx  # 회원가입 (아이디/비번/이름/성별)
src/App.jsx               # 라우터 + 네비바 (로그인 상태 표시)
src/main.jsx              # BrowserRouter 래핑
```

**✅ 실제 백엔드 E2E 검증 완료 (2026-06-14)** — 프로젝트 `pkqqqklwzmwluiexfdhn`.
적용된 설정/사실:
1. `.env.local`: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`(publishable 키). `*.local` 로 git 제외.
2. 마이그레이션 0001~0004 실행 완료.
3. **합성이메일 도메인 = `tennisplan.com`** (`authHelpers.js`). ⚠️ `.local`/`.app` 은 Supabase 가 거부 → 실제 TLD 필수.
4. Supabase Auth: **Confirm email OFF**, **Allow new users to sign up ON** (둘 다 안 맞으면 가입/로그인 실패).
5. 프로필/기본 member 역할은 **DB 트리거 `handle_new_user`** 가 생성 (클라 insert 제거 = 보안).

**남은 운영 작업**:
- 첫 admin 지정: 대시보드에서 `user_roles` 에 (해당 user_id, admin role_id) insert.
- 테스트 계정 `testuser1` 삭제 (Authentication → Users).
- 브라우저 UI 클릭 검증 (curl E2E 는 통과, 화면 클릭은 미확인).

---

## 8. 참고 문서
- `PLAN.md` — 전체 기획 (⚠️ 바이너리 .docx 형식. 텍스트로 추출해 읽음)
- `DRAW_RULES.md` — 대진 룰셋 (엔진 스펙 원본)
- `TODO.md` — 체크리스트 (이번 세션 반영 완료)
- `supabase/README.md` — 마이그레이션 실행법 + 인증 결정 기록
