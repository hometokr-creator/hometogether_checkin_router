# 1. 전체 구조 요약

현재 프로젝트는 다음 구조로 작동해.

```text
카카오톡 사용자
→ 카카오 챗봇 폴백 블록
→ Vercel의 Next.js API
→ 카카오 사용자 식별
→ Supabase PostgreSQL 조회
→ 메시지 분류
→ 이벤트·이슈·티켓 저장
→ 카카오 응답
```

운영자는 별도의 운영자 콘솔에서 카카오 연결 코드를 발급하고, 추후 접수된 이슈와 티켓을 처리하게 되는 구조야.

기술 스택은 다음과 같아.

- 프론트엔드·API: Next.js 16 App Router
- 언어: TypeScript
- DB: Supabase PostgreSQL
- ORM: Prisma 7
- 배포: GitHub `main` → Vercel 자동 배포
- 사용자 채널: 카카오톡 챗봇
- 입력 검증: Zod
- 테스트: Vitest

---

# 2. 핵심 작동 흐름

## 최초 회원 연결

```text
운영자
→ 회원·계약 선택
→ 15분짜리 일회성 코드 발급
→ 회원에게 코드 전달

회원
→ 카카오 채팅에 연결 코드 입력
→ 카카오 사용자 키와 회원 정보 연결
→ 코드 즉시 폐기

이후
→ 회원은 코드 없이 카카오톡으로 계속 문의
```

## 일반 문의 접수

```text
회원: “밤마다 TV 소리가 커서 잠을 못 자겠어요.”

카카오
→ 운영 API 호출
→ 카카오 사용자 키 조회
→ 연결된 member/household/contract 확인
→ 메시지 저장
→ NOISE / S2 / SAME_DAY 분류
→ B 경로 결정
→ 운영자 티켓 생성
→ 접수 안내 응답
```

---

# 3. 카카오 연동 방식

카카오 챗봇 관리자센터에는 다음 운영 엔드포인트가 연결돼 있어.

```text
POST https://hometogether-checkin-router.vercel.app/api/inbound/kakao
```

카카오는 메시지가 들어오면 공식 `SkillPayload` 형식으로 서버에 전달해.

중요하게 사용하는 값은 다음과 같아.

```text
userRequest.utterance
→ 사용자가 입력한 문장

userRequest.user.id
→ 해당 봇 기준 카카오 사용자 키

userRequest.user.properties.plusfriendUserKey
→ 카카오톡 채널 사용자 식별값
```

서버는 `plusfriendUserKey`가 있으면 우선 사용하고, 없으면 `user.id`를 사용해.

관련 코드:

- [카카오 수신 API](C:\Users\PC\Documents\New project\src\app\api\inbound\kakao\route.ts)
- [카카오 페이로드 스키마](C:\Users\PC\Documents\New project\src\modules\kakao\skill.ts)

---

# 4. 회원 연결 코드 작동 원리

연결 코드는 회원 ID 자체가 아니야.

| 값 | 의미 | 수명 |
|---|---|---|
| `memberId` | 홈투게더 내부 회원 식별자 | 지속 |
| `contractCycleId` | 거주 계약 회차 | 계약 회차 동안 지속 |
| 카카오 사용자 키 | 카카오 계정 식별값 | 카카오가 매 요청에 전달 |
| 연결 코드 | 두 시스템을 최초 연결하는 인증값 | 15분·1회 |

## 발급

운영자 콘솔이 다음 API를 호출해.

```text
POST /api/channel-links/tokens
```

서버는:

1. `INTERNAL_API_KEY` 확인
2. 회원과 계약 회차 존재 여부 확인
3. 동일 가구인지 확인
4. 계약 상태가 `ACTIVE`인지 확인
5. 32바이트 무작위 토큰 생성
6. 이전 활성 토큰 폐기
7. 토큰 원문 대신 해시만 DB에 저장
8. 원문 토큰은 발급 응답에서 한 번만 반환

## 사용

회원이 카카오 채팅에 다음처럼 입력해.

```text
연결코드: 토큰값
```

서버는:

1. 카카오 사용자 키 확인
2. 토큰과 사용자 키를 pepper가 포함된 SHA-256으로 해시
3. DB 트랜잭션 시작
4. 토큰의 존재·만료·사용 여부 확인
5. 다른 회원과 이미 연결된 카카오 계정인지 확인
6. `channel_identity_links` 생성
7. 토큰을 `USED`로 변경
8. 감사 로그 생성
9. 트랜잭션 완료

동일 코드를 다시 사용하면 차단돼.

관련 코드:

- [연결 코드 서비스](C:\Users\PC\Documents\New project\src\modules\kakao\linking-token.ts)
- [Prisma 연결 저장소](C:\Users\PC\Documents\New project\src\infrastructure\db\prisma-linking-token-repository.ts)
- [발급 API](C:\Users\PC\Documents\New project\src\app\api\channel-links\tokens\route.ts)

---

# 5. 카카오 문의 분류 방식

현재는 LLM을 사용하지 않고 규칙 기반으로 분류해.

이유는 초기 단계에서 비용 없이 결정론적으로 작동시키고, 위험한 자동 추론을 막기 위해서야.

현재 주요 규칙은 다음과 같아.

| 표현 예시 | 영역 | 처리 |
|---|---|---|
| 화재, 가스 냄새, 폭행, 자해 | `SAFETY` | S3·즉시 B |
| 고장, 누수, 보일러, 에어컨 | `FACILITY` | C |
| 소음, 시끄러움, TV 소리 | `NOISE` | S2·B |
| 계약, 퇴거, 해지, 보증금 | `CONTRACT` | 근거 확인을 위해 B |
| 정산, 전기요금, 관리비 | `SETTLEMENT` | 근거 확인을 위해 B |
| 인식 불가 | `OTHER` | 낮은 신뢰도로 B |

예를 들어:

```json
{
  "intent": "COMPLAINT",
  "domain": "NOISE",
  "severity": "S2",
  "urgency": "SAME_DAY",
  "direction": "G_TO_H",
  "interventionPreference": "COORDINATE",
  "distressSignal": "EXPLICIT",
  "riskFlags": ["NONE"],
  "confidence": 0.94
}
```

관련 코드:

- [인바운드 분류기](C:\Users\PC\Documents\New project\src\modules\classification\classify-inbound.ts)
- [분류 스키마](C:\Users\PC\Documents\New project\src\modules\classification\schema.ts)
- [A/B/C 라우팅](C:\Users\PC\Documents\New project\src\modules\routing\decide-route.ts)

---

# 6. A/B/C 라우팅

## A: 근거 기반 즉답

다음 조건이 필요해.

- S1 문의
- 확정된 계약·생활규칙·정산 근거 존재
- 근거 충돌 없음
- 위험 신호 없음

현재 가구별 계약 조항 조회가 아직 구현되지 않았기 때문에 대부분 A가 아니라 B로 넘어가.

## B: 운영자 확인

다음 경우 B로 처리해.

- 낮은 분류 신뢰도
- 소음·갈등·불만
- 안전·건강·법률 위험
- 상대방과 조율 필요
- 계약 근거 없음 또는 충돌
- 일반적으로 자동 답변하기 어려운 문의

## C: 시설 처리

시설 문제로 분류되면 C 후보가 돼.

다만 실제 파트너 자동 배차는 꺼져 있고, 현재는 `PARTNER_REVIEW` 티켓만 만들어.

---

# 7. 문의가 DB에 저장되는 방식

연결된 회원이 일반 메시지를 보내면 다음 작업이 하나의 DB 트랜잭션으로 실행돼.

```text
issues 생성
→ household_events 생성
→ B/C이면 action_tickets 생성
→ audit_log 생성
→ 모두 성공하면 commit
→ 하나라도 실패하면 전체 rollback
```

## `household_events`

카카오에서 실제로 일어난 사건을 저장해.

주요 값:

- 가구 ID
- 계약 회차 ID
- 회원 ID
- 이슈 ID
- 출처 `INBOUND`
- 사건 유형 `KAKAO_MESSAGE_RECEIVED`
- 발생 시각
- 메시지 원문 payload

## `issues`

메시지를 업무 단위로 구조화해.

- 분류 결과
- A/B/C 경로
- 심각도
- 긴급도
- 상태
- 시작·종료 시각

현재 초기 상태는 `REPORTED`야.

## `action_tickets`

사람이 실제로 처리해야 할 작업이야.

- B → `OPERATOR_REVIEW`
- C → `PARTNER_REVIEW`
- `IMMEDIATE` → 1시간
- `SAME_DAY` → 8시간
- `NORMAL` → 24시간

현재 티켓 초기 상태는 `OPEN`이야.

관련 코드:

- [인바운드 DB 저장소](C:\Users\PC\Documents\New project\src\infrastructure\db\prisma-inbound-repository.ts)
- [Prisma DB 스키마](C:\Users\PC\Documents\New project\prisma\schema.prisma)

---

# 8. 현재 DB 구조

## 회원·가구·계약

```text
households
members
contract_cycles
```

## 카카오 연결

```text
channel_identity_links
channel_linking_tokens
provider_event_receipts
```

## 문의 처리

```text
household_events
issues
action_tickets
checkin_router_audit_logs
```

모든 라우터 테이블은 RLS가 활성화돼 있어.

`anon`, `authenticated` 역할의 테이블 직접 접근 권한도 회수했기 때문에 브라우저에서 Supabase REST API로 직접 읽을 수 없어.

Vercel 서버만 `DATABASE_URL`을 이용해 PostgreSQL에 직접 연결해.

---

# 9. Supabase와 Prisma 연동 방식

Vercel 서버는 다음 방식으로 DB에 연결해.

```text
Vercel 환경변수 DATABASE_URL
→ @prisma/adapter-pg
→ PrismaClient
→ Supabase PostgreSQL
```

관련 코드:

- [Prisma 연결 클라이언트](C:\Users\PC\Documents\New project\src\infrastructure\db\client.ts)

DB 연결 객체는 서버 프로세스에서 재사용해 불필요한 연결 생성을 줄여.

브라우저에는 다음 값이 노출되지 않아.

- `DATABASE_URL`
- `PROVIDER_USER_KEY_PEPPER`
- 실제 토큰 해시

다만 현재 운영자 콘솔에서는 인증 시스템이 없기 때문에 운영자가 `INTERNAL_API_KEY`를 직접 입력해야 해. 이 키는 브라우저 저장소에는 보관하지 않지만, 정식 운영 전에는 Supabase Auth 기반 운영자 로그인으로 대체해야 해.

---

# 10. 기존 홈투게더 고객 원장 연동

Supabase에는 기존 고객 원장 구조가 이미 있어.

```text
profiles
homes
matches
```

역할은 다음과 같아.

| 기존 원장 | 라우터 |
|---|---|
| `profiles.id` | `members.canonical_profile_id` |
| `homes.id` | `households.canonical_home_id` |
| `matches.id` | `contract_cycles.canonical_match_id` |

현재 기존 원장 데이터는 모두 0건이야.

- `profiles`: 0
- `homes`: 0
- `matches`: 0

그래서 실제 고객은 아직 저장하지 않았어.

## 동기화 API

```text
POST /api/canonical-matches/sync
```

`matchId`를 전달하면 서버가 다음을 확인해.

- 매칭 존재 여부
- 집 활성 상태
- 호스트·게스트 활성 상태
- 프로필 역할
- 매칭 상태
- 기존 매핑 충돌

통과하면 한 번의 트랜잭션으로:

```text
household
+ host member
+ guest member
+ contract cycle
+ audit log
```

를 생성하거나 갱신해.

관련 코드:

- [원장 매칭 동기화](C:\Users\PC\Documents\New project\src\modules\canonical\sync-match.ts)
- [원장 동기화 API](C:\Users\PC\Documents\New project\src\app\api\canonical-matches\sync\route.ts)

---

# 11. 실제 고객 데이터 입력 시점

실제 고객 데이터는 다음 준비가 끝난 후 넣어야 해.

1. `profiles/homes/matches`를 공식 원장으로 확정
2. 운영자 로그인과 권한 구현
3. 개인정보 수집·이용 동의
4. 보존·파기 정책 확정
5. 실제 고객 데이터 이관 검증
6. 가구 간 접근 격리 테스트
7. 계약서 비공개 Storage 구성
8. 운영자 접근 감사 로그 적용

순서는 다음과 같아.

```text
실제 고객 프로필 등록
→ 실제 집 등록
→ 실제 매칭·계약 등록
→ 라우터 동기화
→ 카카오 연결 코드 발급
→ 고객이 최초 인증
→ 카카오 문의 사용
```

---

# 12. 계약서 저장 방식

계약서 저장은 아직 구현되지 않았어.

권장 구조는 다음과 같아.

```text
계약서 PDF 원본
→ 비공개 Supabase Storage

contract_documents 테이블
→ 문서 ID
→ Storage 경로
→ 가구/계약 회차
→ 문서 버전
→ 서명 상태
→ 유효기간
→ 업로드·승인자
→ 해시

contract_clauses 테이블
→ 승인된 조항
→ 적용 영역
→ 유효 시작·종료일
→ 근거 문서 ID
→ 활성 상태
```

카카오 A경로 답변은 PDF 전체를 직접 읽어서 임의로 답하는 방식이 아니라, 운영자가 승인한 `ACTIVE` 조항만 조회해야 해.

---

# 13. 사용자 흐름

## 신규 사용자

```text
1. 홈투게더 계약 완료
2. 운영자가 카카오 연결 코드 발급
3. 사용자가 카카오 채팅에 코드 입력
4. 회원·가구·계약 연결
5. 이후 코드 없이 문의
```

## 문의 사용자

```text
1. 카카오에 자유롭게 메시지 입력
2. 시스템이 회원·가구 확인
3. 메시지 저장 및 분류
4. 운영자 또는 파트너 티켓 생성
5. 사용자에게 접수 응답
6. 운영자 처리
7. 최종 결과 회신
```

현재는 1~5까지 구현됐어. 운영자 처리 결과를 카카오로 다시 보내는 6~7은 아직 구현되지 않았어.

---

# 14. 운영자 흐름

현재 운영자 콘솔:

[운영자 콘솔](https://hometogether-checkin-router.vercel.app)

현재 가능한 일:

- 연결 코드 발급
- 코드 복사
- 테스트 회원·계약 연결
- HH-002 데모 이슈 확인
- 상담원 전환·배정·초안 승인 UI 시연

현재 한계:

- 운영자 로그인 없음
- 실제 회원 검색 없음
- 실제 DB 이슈 목록 미표시
- 실제 티켓 상태 변경 미구현
- 승인 답변 카카오 발송 미구현
- 콘솔의 HH-002 내용은 아직 고정 데모

정식 운영 흐름은 다음처럼 바뀌어야 해.

```text
운영자 로그인
→ 실제 이슈 큐 조회
→ 이슈 선택
→ 원문·분류·근거 확인
→ 담당자 배정
→ 답변 작성·승인
→ 카카오 회신
→ 해결 상태 변경
→ 후속 체크인 예약
```

---

# 15. 현재 보안 구조

구현된 보안:

- 카카오 사용자 키 원문 미저장
- 사용자 키를 pepper 포함 해시로 저장
- 연결 토큰 원문 미저장
- 토큰 15분 만료
- 토큰 1회 사용
- 연결 충돌 차단
- DB 트랜잭션 사용
- RLS 활성화
- 브라우저 DB 직접 접근 차단
- 감사 로그에 카카오 키·토큰·문의 원문을 중복 기록하지 않음
- API 키 비교 시 timing-safe 비교 사용

추가로 필요한 보안:

- 운영자 로그인
- 역할 기반 권한
- API rate limit
- 웹훅 중복 방지 완성
- 메시지 원문 보존·삭제 정책
- 민감정보 마스킹
- 계약서 비공개 Storage
- 다운로드 감사 로그
- 데이터 암호화·백업 정책
- 실제 카카오 요청 진위 검증 방식 확인

---

# 16. 현재 실제로 되는 것과 남은 것

## 구현 완료

- Vercel 운영 배포
- Supabase 연결
- Prisma 마이그레이션
- 카카오 공식 스킬 요청 수신
- 카카오 사용자 연결
- 일회성 연결 코드
- 연결 후 코드 없는 문의
- 문의 원문 이벤트 저장
- 규칙 기반 분류
- A/B/C 결정
- 이슈 생성
- 티켓 생성
- SLA 계산
- 감사 로그
- 기존 고객 원장 매핑 구조
- 테스트 26개 및 빌드 통과

## 다음 우선순위

1. 운영자 콘솔에 실제 이슈·티켓 목록 표시
2. 이슈 상세 조회 API
3. 담당자 배정·상태 변경
4. 운영자 승인 답변의 카카오 발송
5. 웹훅 중복 처리 완성
6. 계약서 비공개 Storage
7. 계약 문서·승인 조항 테이블
8. A경로 근거 기반 답변
9. 실제 회원 검색과 운영자 인증
10. 필요하면 LLM 분류 추가

현재 시스템은 **카카오 사용자 연결 → 문의 저장 → 규칙 분류 → 운영자 티켓 생성**까지 실제로 이어진 상태야. 다음 핵심 개발은 고정 데모 운영자 화면을 실제 DB 이슈 큐로 교체하는 작업이야.