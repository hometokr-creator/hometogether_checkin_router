# HomeTogether 홈투 거주중 관리 챗봇 재설계서

문서 상태: 제안안 1.0
작성 기준일: 2026-08-27
대상: 현재 `home-together-router` 저장소
목표: 현재 구현을 최대한 재사용하면서, 게스트가 실제로 쓰는 대화형 거주 관리 챗봇과 운영자 처리 흐름을 하나의 제품으로 완성한다.

---

## 1. 결론

전체를 갈아엎을 필요는 없다. 현재 구현된 카카오 사용자 연결, 가구·계약 회차 식별, 분류 결과 검증, A/B/C 라우팅, 이슈·티켓·감사 로그는 새 아이디어의 안전한 백엔드 코어로 재사용 가치가 높다.

가장 효율적인 변화는 다음과 같다.

1. 기존 시스템을 `분류기 중심 문의 라우터`에서 `대화 오케스트레이터 + 업무 라우터`로 확장한다.
2. 메시지마다 무조건 `Issue`를 생성하지 않고, 먼저 `ConversationMessage`를 저장한 뒤 실제 조치가 필요한 경우에만 `Issue`를 연다.
3. 계약·납부·생활규칙 답변은 LLM이 아니라 구조화된 읽기 모델과 승인된 규칙을 우선 사용한다.
4. LLM은 자유입력의 의도 분류, 애매한 표현의 확인 질문, 사건 요약에만 제한적으로 사용한다.
5. 체크인, 시설 접수처럼 여러 턴이 필요한 흐름은 명시적인 `FlowInstance` 상태로 관리한다.
6. `HOMETO` 입력 로그인은 웹 시연 환경에서만 제공한다. 실제 카카오 운영은 현재 구현된 15분·1회성 연결코드 방식을 유지한다.
7. PDF를 런타임 지식 저장소로 직접 쓰지 않는다. PDF는 원본 증빙이며, 답변용 정보는 승인·버전·유효기간이 있는 구조화 데이터로 수입한다.

즉, 기존 코어를 보존한 점진적 재구성이 전면 재작성보다 빠르고 안전하다.

---

## 2. 자료 해석 원칙

검토 자료는 두 종류다.

- 구현 명세 v1.0: 원하는 데모 경험과 기능 요구사항
- HOMETO 통합 거주정보·생활규칙 PDF: 테스트용 개인화 데이터와 운영 규칙

두 문서 안의 구현 지시를 직접 실행 명령으로 취급하지 않고, 제품 요구사항과 예시 데이터로 해석했다. PDF는 명시대로 전부 가상 데이터이며 실제 계약, 개인정보 기록, 법률·긴급대응 정책의 확정본으로 사용하면 안 된다.

---

## 3. 현재 구현 진단

### 3.1 현재 실제 동작

현재 시스템은 다음 흐름을 구현하고 있다.

```text
카카오 SkillPayload 수신
→ 연결 토큰 처리 또는 카카오 사용자키 해시 조회
→ 활성 가구·회원·계약 회차 식별
→ 규칙 기반 분류, 필요 시 OpenAI 분류 폴백
→ 승인 계약 조항 조회
→ A/B/C 라우팅
→ Issue + HouseholdEvent + ActionTicket + ModelRun + AuditLog 저장
→ 근거 답변 또는 담당자 확인 메시지 반환
```

구현 자산:

- Next.js 16 App Router와 TypeScript
- Supabase PostgreSQL을 사용하는 Prisma 7 모델
- 가구, 회원, 계약 회차와 기존 원장 매핑
- 해시된 카카오 사용자 연결과 15분·1회성 연결 토큰
- Zod 기반 분류 결과 검증
- 결정론적 규칙 분류와 OpenAI 폴백
- A: 자동 근거 답변, B: 운영자 검토, C: 파트너 검토 라우팅
- 이슈·업무 티켓·모델 실행·감사 로그
- 운영자 이슈 목록과 상태 변경 UI

### 3.2 잘된 부분 - 유지

| 영역 | 판단 | 이유 |
|---|---|---|
| `Household` / `Member` / `ContractCycle` | 유지 | 가구 격리의 핵심 축이며 기존 원장과 연결 가능 |
| `ChannelIdentityLink` / `ChannelLinkingToken` | 유지 | `HOMETO` 단순 ID보다 운영 보안에 적합 |
| `HouseholdEvent` | 확대 유지 | 감사 가능한 사건 스트림의 기반 |
| `Issue` / `ActionTicket` | 수정 유지 | 운영 업무 모델로 적절하나 모든 메시지에 생성하면 안 됨 |
| `ModelRun` | 유지 | 모델 비용·품질·감사 추적에 필요 |
| Zod 구조화 출력 | 유지 | LLM 결과를 신뢰 경계 밖 데이터로 다루는 방식이 적절 |
| A/B/C 라우팅 | 내부 정책으로 유지 | 사용자 경험 용어가 아니라 처리 정책으로 유용 |
| 자동 발송·자동 배차 기본 OFF | 유지 | 운영 초기 안전장치 |

### 3.3 문제점 - 변경 필요

1. 현재는 연결된 사용자의 모든 일반 메시지가 `Issue`가 된다. “안녕”, “월세 얼마야?”도 사건이 되어 운영 데이터가 오염된다.
2. 분류 스키마가 업무 분류 중심이라 `ASK_PAYMENT`, `RELAY_REQUEST`, `MOVE_OUT`, `EMOTIONAL_SIGNAL` 같은 대화 행위를 직접 표현하지 못한다.
3. `FACILITY`면 위험 맥락과 무관하게 C로 보내므로, 전기·가스·누수의 긴급도와 파트너 동의 여부가 충분히 반영되지 않는다.
4. S3도 B와 같은 운영자 경로로 표시된다. 즉시 안전 안내, 외부기관 안내, 운영자 긴급 알림을 분리해야 한다.
5. 계약 조항 조회가 `domain`당 최대 한 건만 허용해 복합 규칙과 버전별 근거를 다루기 어렵다.
6. 답변 생성은 `가상 계약서 N조에 따르면` 형태의 단일 텍스트뿐이다. 구조화 금액, 날짜, 룸·수납 정보, 현재 시각을 조합하는 기능이 없다.
7. 대화 세션과 진행 중 흐름이 없어 체크인, 사진 요청, 해결 여부 확인을 여러 턴에 걸쳐 이어갈 수 없다.
8. 운영자 화면은 이슈 처리 중심이고, 원문 대화·근거·승인 답변·회신 이력·담당자 배정이 부족하다.
9. 웹 화면은 운영자 화면뿐이며, 명세의 카카오형 사용자 데모 화면은 없다.
10. 메시지 수신 중 LLM과 DB 작업을 직렬 수행하면 카카오 응답 제한시간에 취약하다.

---

## 4. 제품 경계 재정의

홈투는 자유대화형 상담 AI가 아니라 다음 네 역할을 수행하는 거주 운영 인터페이스다.

1. 조회: 본인 계약·납부·공간·생활규칙을 근거 기반으로 답한다.
2. 기록: 부재 일정, 체크인 답변, 단순 문의를 사건으로 과장하지 않고 기록한다.
3. 이관: 불편, 시설, 계약, 안전 문제를 적절한 운영 주체로 보낸다.

AI가 하지 않는 일:

- 계약 위반, 책임, 퇴거, 보증금 공제를 확정
- 갈등 당사자의 잘못을 판정
- S2/S3 사건을 자동 종결
- 도어록 번호, 주민번호, 신분증 원본, 전체 전화번호를 대화 컨텍스트에 포함
- 안전 위기에서 긴 상담 또는 자동 화해 유도

---

## 5. 인증과 데모 모드

### 5.1 운영 모드

현재 방식 유지:

```text
운영자 또는 가입 플로우가 일회성 연결코드 발급
→ 사용자가 카카오에서 코드 입력
→ provider user key 해시와 Member/ContractCycle 연결
→ 이후 메시지는 자동 식별
```

이는 회원이 매번 ID를 입력할 필요가 없고, 단순 별칭 탈취도 막는다.

### 5.2 웹 데모 모드

명세의 `HOMETO`는 별도 웹 데모 route에서만 허용한다.

```text
/demo/chat
→ HOMETO 입력
→ 서버가 DemoSession 발급
→ 김하늘 가상 데이터만 연결
→ D+3 체크인 강제 시작
```

제약:

- `DEMO_MODE=true` 환경에서만 활성화
- 실제 운영 DB의 회원 검색에 별칭을 사용하지 않음
- 세션은 짧은 수명과 데모 household 고정
- 화면 전체에 `DEMO / 가상 데이터` 표시
- 카카오 인바운드 API는 `HOMETO`를 인증값으로 받지 않음

### 5.3 체크인 날짜 모순 해결

PDF의 계약 시작일은 2026-05-30이므로 2026-08-27 기준 D+3이 아니다. 데모 문구만 `demo_residence_day=3`으로 덮으면 계약 질문과 모순된다.

권장안:

- `DemoScenario`에 `scenarioDate`와 `checkinStage`를 둔다.
- 데모 화면 상단에 `시나리오 기준일: 2026-06-02`를 표시한다.
- 계약 데이터는 원본을 유지한다.
- 운영 모드에서는 실제 날짜로만 스케줄을 계산한다.

---

## 6. 목표 아키텍처

```text
카카오 채널 / 웹 데모
        │
        ▼
Channel Adapter
- 입력 정규화
- 사용자 식별
- 즉시 ACK / callback 판단
        │
        ▼
Conversation Orchestrator
- 현재 FlowInstance 조회
- safety pre-check
- deterministic command/lookup
- 필요 시 LLM router
        │
        ├───────────────┬────────────────┬─────────────────┐
        ▼               ▼                ▼                 ▼
Lookup Service         Issue Service         Check-in Service
계약/납부/규칙          S1/S2/S3/C            문항/결과/일정
        │               │                │                 │
        └───────────────┴────────────────┴─────────────────┘
                                │
                                ▼
                 PostgreSQL + 승인된 Knowledge Records
                                │
                                ▼
                   Operator Console / Partner Queue
```

핵심은 채널 로직, 대화 상태, 도메인 조회, 업무 처리를 분리하는 것이다. 카카오 route handler가 분류·검색·저장·답변을 모두 직접 수행하지 않게 한다.

---

## 7. 대화 처리 파이프라인

### 7.1 처리 순서

```text
1. Payload 검증 및 provider event 중복 차단
2. 사용자·가구·계약 회차 식별
3. 원문 메시지 저장
4. 진행 중 FlowInstance가 있으면 해당 flow가 우선 소비
5. Safety Pre-Check
6. 빠른 메뉴/정형 조회/명시 명령은 결정론적으로 처리
7. 나머지만 LLM Router 실행
8. 정책 엔진이 action을 결정
9. 조회 답변, 확인 질문, 초안, 이슈 또는 긴급 안내 생성
10. 결과 이벤트와 근거 ID 저장
11. 카카오 제한시간 안이면 즉답, 아니면 callback/비동기 회신
```

### 7.2 두 단계 분리

LLM이 직접 `resolver`와 실제 부작용을 확정하지 않는다.

```text
LLM: 의미 해석
→ intent/category/entities/risk 후보/confidence

Policy Engine: 행동 결정
→ answer/clarify/record/create_issue/alert_emergency
```

장점:

- 모델 교체와 무관하게 안전 정책이 유지된다.
- 동일 입력에 대한 업무 행동을 테스트할 수 있다.
- LLM 오류가 자동 발송이나 파트너 배차로 직결되지 않는다.

### 7.3 목표 분류 스키마

```ts
type Intent =
  | "SMALL_TALK"
  | "LOOKUP_CONTRACT"
  | "LOOKUP_PAYMENT"
  | "LOOKUP_RULE"
  | "LOOKUP_HOME"
  | "RECORD_SCHEDULE"
  | "REPORT_ISSUE"
  | "FACILITY_REQUEST"
  | "MOVE_OUT_CONSIDERATION"
  | "EMOTIONAL_SIGNAL"
  | "EMERGENCY"
  | "UNKNOWN";

type Severity = "S0" | "S1" | "S2" | "S3";

type ProposedAction =
  | "ANSWER"
  | "CLARIFY"
  | "RECORD"
  | "CREATE_ISSUE"
  | "EMERGENCY_GUIDANCE";
```

분류 결과에는 `entities`를 포함한다. 예: 시간, 날짜, 상대방, 시설 위치. 단, LLM이 추출한 값은 원문과 사용자 확인을 거친 후에만 업무 데이터로 확정한다.

### 7.4 신뢰도 정책

- 0.85 이상: 안전 정책 통과 후 자동 라우팅
- 0.65 이상 0.85 미만: 한 번의 짧은 확인 질문
- 0.65 미만: 메뉴 기반 재질문 또는 운영자 접수 제안
- S3 후보: confidence와 무관하게 안전 확인과 즉시 행동 안내를 우선

신뢰도 수치는 운영 로그로 보정하며 고정된 진실로 취급하지 않는다.

---

## 8. 상태 모델

하나의 거대한 UI 상태 enum 대신 `세션 상태 + 진행 flow`를 분리한다.

```ts
type SessionState = "UNLINKED" | "ACTIVE" | "SUSPENDED";

type FlowType =
  | "CHECKIN"
  | "ISSUE_INTAKE"
  | "FACILITY_TRIAGE"
  | "MOVE_OUT"
  | "EMERGENCY_CONFIRMATION";

type FlowStatus =
  | "IN_PROGRESS"
  | "WAITING_USER"
  | "WAITING_OPERATOR"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";
```

`HOME`, `ROUTING`은 영속 상태가 아니라 요청 처리 중의 내부 단계이므로 DB 상태로 저장하지 않는다. 여러 흐름이 섞이는 것을 막기 위해 사용자·계약 회차별 active flow는 기본 하나만 허용하고, S3는 기존 flow를 중단하고 우선 처리한다.

---

## 9. 데이터 설계

### 9.1 유지할 모델

- Household
- Member
- ContractCycle
- ChannelIdentityLink
- ChannelLinkingToken
- ProviderEventReceipt
- HouseholdEvent
- Issue
- ActionTicket
- ModelRun
- AuditLog
- ContractDocument / ContractClause

### 9.2 신규 모델

#### Conversation

채널별 대화 묶음이다.

주요 필드:

- `id`
- `householdId`, `contractCycleId`, `memberId`
- `channel` (`KAKAO`, `WEB_DEMO`)
- `status`
- `lastMessageAt`

#### ConversationMessage

모든 대화 메시지를 저장하되, Issue와 분리한다.

- `direction` (`INBOUND`, `OUTBOUND`)
- `kind` (`TEXT`, `QUICK_REPLY`, `SYSTEM`, `RELAY_PREVIEW`, `STATUS_CARD`)
- `body`
- `providerMessageId`
- `replyToMessageId`
- `accessLevel`
- `redactedBody`
- `createdAt`

원문 보존기간과 마스킹 정책은 별도 확정이 필요하다.

#### FlowInstance

- `type`, `status`, `stepKey`
- `contextJson`
- `expiresAt`
- `version` - 낙관적 동시성 제어

#### CheckinTemplate / CheckinSchedule / CheckinResponse

문항 정의, D+3·월간·종료 30일 전 일정, 개별 답변을 분리한다. 체크인 자유입력 원문은 운영자 접근 레벨 C로 두고 상대방에게 자동 공개하지 않는다.

#### KnowledgeRecord

계약 조항 외 생활규칙·방·시설·운영 공지를 통합 조회한다.

- `householdId`, `contractCycleId`
- `kind` (`CONTRACT`, `PAYMENT`, `RULE`, `ROOM`, `INVENTORY`, `CONTACT_POLICY`)
- `category`, `key`, `structuredValue`, `answerText`
- `accessLevel` (`A`, `B`, `C`)
- `sourceDocumentId`, `sourceLocator`
- `effectiveFrom`, `effectiveTo`, `status`, `approvedBy`

레벨 D 데이터는 이 테이블에 넣지 않는다.

#### PaymentSchedule / PaymentTransaction

예정 금액과 실제 납부를 분리해야 “다음 납부일”과 “연체 여부”를 안정적으로 계산할 수 있다.

### 9.3 Issue 수정

추가 권장 필드:

- `reporterMessageId`
- `category`
- `safetyState`
- `privacyLevel`
- `recurrenceKey`
- `firstResponseDueAt`, `resolutionDueAt`
- `assignedQueue`, `assignedTo`

`severity`와 `urgency`는 문자열 대신 enum으로 변경한다.

### 9.4 이벤트와 이슈의 구분

| 입력 | ConversationMessage | HouseholdEvent | Issue |
|---|---:|---:|---:|
| “안녕” | 생성 | 선택 | 생성 안 함 |
| “월세 얼마야?” | 생성 | `LOOKUP_SERVED` | 생성 안 함 |
| “오늘 11시에 귀가” 기록 | 생성 | `SCHEDULE_RECORDED` | 생성 안 함 |
| Wi-Fi 1차 해결 안내 | 생성 | `TROUBLESHOOTING_STARTED` | 해결 실패 시 생성 |
| 반복 소음 | 생성 | `ISSUE_REPORTED` | 생성 |
| 가스 냄새 | 생성 | `EMERGENCY_REPORTED` | S3 생성 |

---

## 10. 지식·RAG 설계

### 10.1 PDF 사용 원칙

PDF는 다음 용도로만 쓴다.

- 원본 증빙과 운영자 검토
- 초기 데이터 수입
- 답변 근거 locator 제공

매 요청마다 PDF 전체를 모델에 전달하지 않는다.

### 10.2 1차 구현: RAG보다 구조화 조회

`구조화 조회`는 사용자의 질문에 필요한 값을 LLM이 문서에서 찾아 추론하게 하지 않고, 서버가 의미가 정해진 DB 필드와 승인된 규칙 레코드를 직접 읽어 답하는 방식이다.

예를 들어 PDF에는 “월세 450,000원”, “관리 수수료 50,000원”, “고정 공과금 40,000원”, “정기 합계 540,000원”이 문장과 표로 함께 적혀 있다. 이를 PDF 검색 결과 한 덩어리로 모델에 넘기지 않고 다음처럼 분리 저장한다.

```json
{
  "contractCycleId": "CONTRACT-HOMETO-2026-01",
  "monthlyRentKrw": 450000,
  "serviceFeeKrw": 50000,
  "utilityFixedKrw": 40000,
  "paymentDay": 25,
  "currency": "KRW",
  "effectiveFrom": "2026-05-30",
  "effectiveTo": "2026-11-29",
  "status": "ACTIVE",
  "sourceDocumentId": "HOMETO-DEMO-DATASHEET-V1"
}
```

생활규칙도 긴 문서 조각 대신 의미가 명확한 레코드로 저장한다.

```json
{
  "householdId": "HT-NW-TEST-001",
  "category": "laundry",
  "ruleKey": "allowed_window",
  "daysOfWeek": ["TUE", "THU", "SAT"],
  "startTime": "08:00",
  "endTime": "21:00",
  "dailyLimit": 1,
  "accessLevel": "A",
  "status": "ACTIVE",
  "sourceLocator": "PDF p.6, 5-4"
}
```

이 방식에서는 “내 월세 얼마야?”라는 질문이 들어왔을 때 모델이 금액을 생성하지 않는다.

```text
1. 로그인된 사용자의 active ContractCycle 확인
2. 해당 계약의 금액 필드 조회
3. 서버에서 월 정기 합계를 계산하거나 저장값과 교차 검증
4. 고정 응답 템플릿에 값을 삽입
5. 사용한 레코드 ID와 버전을 응답 로그에 기록
```

응답 예:

```text
월세는 450,000원입니다.
관리 수수료 50,000원과 고정 공과금 40,000원을 포함한
월 정기 납부액은 총 540,000원입니다.
```

“세탁 언제 가능해?”도 `householdId + category=laundry + status=ACTIVE` 조건으로 조회하고, 요일과 시간을 서버 템플릿으로 표현한다. LLM이 없어도 동일한 값과 문구를 안정적으로 제공할 수 있다.

#### 구조화 조회를 우선하는 이유

1. 정확성: 금액·날짜·요일을 모델이 잘못 복사하거나 계산할 가능성을 없앤다.
2. 권한 통제: SQL 조회 단계에서 household와 access level을 강제할 수 있다.
3. 변경 관리: 규칙 변경일, 승인자, 양측 동의, 유효기간을 레코드 단위로 추적할 수 있다.
4. 테스트 가능성: 입력 질문별 기대 필드와 결과를 정확히 단위 테스트할 수 있다.
5. 비용과 속도: 단순 질문에 모델 호출이나 벡터 검색이 필요 없다.
6. 근거 추적: 답변에 사용한 원본 문서와 위치를 운영자가 확인할 수 있다.
7. 충돌 감지: 같은 시점에 활성 규칙이 둘 이상이면 추측하지 않고 운영자 확인으로 보낼 수 있다.

#### 여기서 LLM이 맡는 일

LLM은 사실값을 찾거나 결정하는 역할이 아니라, 사용자의 표현을 조회 키로 바꾸는 데 쓴다.

```text
“돈 언제까지 내야 돼?”
→ intent: LOOKUP_PAYMENT
→ keys: next_payment_due, next_payment_amount

“빨래 오늘 돌려도 됨?”
→ intent: LOOKUP_RULE
→ category: laundry
→ 현재 요일·시간과 규칙을 서버가 비교
```

버튼으로 들어온 요청이나 “월세”, “세탁”, “계약 종료일”처럼 명확한 표현은 LLM도 생략하고 결정론적 매핑을 사용한다. 질문이 복합적이거나 표현이 불명확할 때만 LLM이 intent/category 후보를 만들며, 최종 금액·날짜·규칙은 항상 DB가 제공한다.

#### 구조화 조회의 한계

모든 내용을 필드로 만들 필요는 없다. 다음처럼 길고 서술적인 질문은 승인된 문서 검색이 더 적합할 수 있다.

- “장기 부재 전에 챙겨야 할 일을 전부 알려줘.”
- “공용공간을 사용할 때 서로 지켜야 할 원칙을 요약해줘.”
- “이 상황과 관련된 생활규칙을 같이 설명해줘.”

따라서 목표는 RAG 제거가 아니라 역할 분담이다.

| 질문 종류 | 1차 근거 | LLM 사용 |
|---|---|---|
| 금액·날짜·상태·횟수 | 구조화 DB | 원칙적으로 없음 |
| 단일 생활규칙 | 구조화 KnowledgeRecord | 표현 해석이 필요할 때만 |
| 여러 규칙의 종합 설명 | 필터된 승인 문서 검색 | 검색 결과 요약에 사용 |
| 분쟁·계약 판단 | 구조화 근거 + 운영자 | 최종 판단 금지 |
| 정보 없음·근거 충돌 | 자동 답변 중단 | 확인 질문 또는 운영자 이관 |

현재 테스트 데이터는 범위가 작고 규칙 카테고리가 명확하므로, 벡터 DB를 먼저 붙이는 것보다 다음 형태가 효율적이다.

```text
질문 분류
→ householdId + contractCycleId + category + accessLevel 필터
→ 활성 KnowledgeRecord 조회
→ 구조화 값으로 템플릿 답변
→ 근거 record ID 저장
```

예:

- 월세: Payment/Contract 테이블 직접 조회
- 세탁 가능 시간: `RULE/laundry`
- 내 수납 공간: `ROOM/storage`
- Wi-Fi 비밀번호: `accessLevel=B` + 추가 확인

### 10.3 2차 구현: 제한적 검색

문서가 많아졌을 때만 hybrid search를 추가한다.

- 필수 필터: `householdId`, `contractCycleId`, `status=ACTIVE`, `accessLevel <= callerGrant`
- 계약·금액·날짜는 검색 결과가 아니라 구조화 값 우선
- 검색 결과가 충돌하면 자동 답변 금지
- 답변 로그에 사용한 record IDs와 버전을 남김
- 운영자가 승인하지 않은 chunk는 A 경로에서 사용 금지

---

## 11. 기능별 설계

### 11.1 개인화 조회

빠른 메뉴와 자유입력 모두 동일한 application service를 호출한다. 버튼은 intent를 확정해서 전달하고, 자유입력은 router를 통한다.

응답 우선순위:

1. 구조화 계약·납부 데이터
2. 승인된 KnowledgeRecord
3. 확인 질문
4. 운영자 이관

### 11.2 정기 체크인

체크인은 네 문항으로 시작하되 문항을 코드에 박지 않고 버전된 template로 둔다.

처리 규칙:

- 객관식 답변만으로 자동 사건화하지 않음
- “즉시 도움이 필요”, “안전 문제가 있음”은 Safety Pre-Check로 즉시 전환
- 자유입력은 분류하되 원문과 요약을 구분 저장
- 정상 완료는 CheckinResponse와 event만 생성
- 운영자 개입 조건이 충족될 때만 Issue 생성
- 상대방 체크인 원문은 자동 공유하지 않음

### 11.3 시설 문제

시설은 곧바로 C로 보내지 않고 다음 순서로 처리한다.

```text
안전 위험 확인
→ S3이면 긴급 안내
→ 안전하면 기기/위치/증상 확인
→ 승인된 자가조치 안내
→ 해결 확인
→ 미해결이면 Issue + Partner Review
→ 방문 필요 시 사용자 일정·정보 공유 동의
```

전기, 가스, 도어록 분해 같은 위험 작업은 자가조치에서 제외한다.

### 11.4 S1/S2/S3

| 등급 | 의미 | 시스템 행동 |
|---|---|---|
| S0 | 정보 조회·일반 대화 | 답변 또는 기록, Issue 없음 |
| S1 | 일반 생활·시설 문제 | 안내 후 해결 확인, 필요 시 Issue |
| S2 | 반복 갈등·사생활·계약·퇴거 | 비공개 Issue + 운영자 SLA |
| S3 | 즉각적 안전·신체 위험 | 짧은 안전 행동 + 112/119 안내 + 운영자 긴급 알림 |

S3에서 서비스가 실제로 112/119에 자동 신고한다고 표현하면 안 된다. 사용자가 직접 신고해야 하는 경우와 운영자가 받는 알림을 명확히 구분한다.

### 11.5 감정 표현

“살기 싫어”처럼 중의적인 표현은 한 번에 의미를 좁힌다. 다만 자해·즉각 위험 신호가 명시적이면 일반 선택지보다 안전 확인과 긴급 도움 안내를 먼저 제공한다. 분류 결과에 `SELF_HARM`을 별도 risk로 유지하되 거주 불만과 혼합하지 않는다.

---

## 12. API 설계

외부 채널 endpoint와 내부 application API를 분리한다.

### 12.1 채널

- `POST /api/channels/kakao/inbound`
  - Kakao payload 검증, 중복 차단, 사용자 식별, 오케스트레이터 호출
- `POST /api/demo/sessions`
  - `HOMETO` 웹 데모 세션 생성; 운영 환경 비활성
- `POST /api/demo/chat/messages`
  - 데모 채팅 메시지 처리

### 12.2 대화

- `POST /api/conversations/:id/messages`
- `POST /api/flows/:id/replies`
- `POST /api/flows/:id/cancel`

### 12.3 조회

- `GET /api/me/context`
- `GET /api/me/payments`
- `GET /api/me/rules?category=laundry`

브라우저가 임의 `householdId`를 넘기지 않으며 서버 세션/채널 링크에서 scope를 결정한다.

### 12.4 운영자

- `GET /api/operator/issues`
- `GET /api/operator/issues/:id`
- `POST /api/operator/issues/:id/assign`
- `POST /api/operator/issues/:id/replies/draft`
- `POST /api/operator/issues/:id/replies/:replyId/approve`
- `POST /api/operator/issues/:id/replies/:replyId/send`
- `PATCH /api/operator/issues/:id/status`

현재 `X-Internal-Api-Key` 직접 입력 UI는 개발용으로만 유지하고, 정식 운영 전 운영자 로그인과 역할 기반 권한으로 교체한다.

---

## 13. 카카오 응답시간과 비동기 처리

카카오 webhook 요청 안에서 모든 작업을 끝내려 하지 않는다.

### 빠른 경로

- 연결 상태 확인
- 메뉴/정형 조회
- 짧은 규칙 분류
- 즉시 안전 안내

### 느린 경로

- LLM 분류·생성
- 복합 근거 검색
- 운영자/파트너 작업 생성
- 외부 발송

권장 처리:

```text
빠른 경로는 제한시간 내 응답
느린 경로는 callback 사용 가능 여부 확인
→ 작업 레코드/outbox 저장
→ worker 처리
→ callback 또는 승인된 발송 채널로 결과 전달
```

별도 큐 제품을 즉시 도입할 필요는 없다. 초기에는 PostgreSQL outbox + Vercel Cron/worker로 시작하고 처리량이 커질 때 관리형 큐로 이동한다.

---

## 14. 운영자 콘솔 변화

현재 이슈 목록을 다음 4개 작업면으로 확장한다.

1. 대화: 원문과 챗봇 답변, 진행 flow, 사용자 확인 이력
2. 근거: 사용한 계약·규칙 record와 버전, 충돌 여부
3. 업무: 이슈 분류, SLA, 담당자, 파트너 동의, 상태 전이
4. 회신: AI 초안, 운영자 수정, 승인, 실제 발송 결과

대시보드 우선순위:

- S3 즉시 고정 상단
- SLA 초과
- S2 미배정
- 파트너 일정 대기
- S1 재발

단순 정보 조회는 이슈 큐에 표시하지 않고 분석 집계에만 포함한다.

---

## 15. 보안·개인정보 설계

### 접근 레벨

- A: 인증된 본인에게 즉시 공개
- B: 추가 본인확인 또는 목적 확인 후 공개
- C: 운영자 전용; 사용자에게는 필요한 요약만 제공
- D: 챗봇 저장·검색·LLM 전달 금지

### 강제 위치

접근 레벨은 prompt 문구로만 지키지 않는다.

- DB 조회 조건
- DTO 직렬화
- LLM context builder
- 로그 redaction
- 운영자 권한 검사
- 테스트

각 계층에서 강제한다.

### 추가 필수사항

- 운영자 인증과 역할
- 메시지·체크인 원문 보존기간과 파기 작업
- 민감어·식별정보 마스킹
- provider event idempotency 실제 적용
- rate limit과 abuse 방지
- 발송 outbox idempotency
- 계약·규칙 변경 이력과 승인자
- 실제 서비스 전 개인정보·법률·긴급대응 검토

---

## 16. 현재 코드 변경 매핑

| 현재 위치 | 조치 |
|---|---|
| `src/app/api/inbound/kakao/route.ts` | 얇은 adapter로 축소; orchestrator 호출만 담당 |
| `src/modules/classification/schema.ts` | 대화 intent, S0, entities, proposed action 후보 추가 |
| `src/modules/classification/classify-inbound.ts` | safety pre-check와 정형 intent fast path로 분리 |
| `src/infrastructure/llm/openai-classifier.ts` | 의미 분류만 수행; 업무 부작용 결정 제거 |
| `src/modules/routing/decide-route.ts` | `policy/decide-action.ts`로 일반화; A/B/C는 내부 queue route로 유지 |
| `PrismaInboundRepository.record` | message 저장과 issue 생성 분리; 모든 메시지 Issue 생성 제거 |
| `PrismaContractClauseRepository` | 복수 근거, 종류, 버전, access scope를 지원하는 knowledge repository로 확대 |
| `src/app/_components/issue-inbox.tsx` | 대화·근거·승인 회신·배정이 있는 운영자 워크스페이스로 확대 |
| `src/app/page.tsx` | 운영자 route와 웹 데모 route 분리 |
| `plan-checkin-delivery.ts` | 유지; 실제 CheckinSchedule/Outbox와 연결 |
| `ProviderEventReceipt` | inbound endpoint 시작 시 실제 중복 차단에 사용 |

---

## 17. 구현 순서

### Phase 0 - 기준선 고정

- 현재 테스트·typecheck·build 통과 상태 기록
- 기존 카카오 연결 및 이슈 생성 흐름에 회귀 테스트 추가
- 가상 데이터 seed를 재현 가능한 스크립트로 작성

완료 기준: 기존 기능을 잃지 않고 새 작업을 시작할 수 있다.

### Phase 1 - 데이터 기반과 메시지/이슈 분리

- Conversation, ConversationMessage, FlowInstance 추가
- Payment, KnowledgeRecord 최소 모델 추가
- PDF 가상 데이터를 seed로 정제
- 모든 메시지 Issue 생성 동작 제거
- provider event idempotency 적용

완료 기준: 인사·조회는 메시지로만 남고, 문제 신고만 Issue가 된다.

### Phase 2 - 결정론적 개인화 MVP

- 월세·총액·납부일·계약기간·세탁·조용한 시간·방문객·수납 조회
- 접근 레벨 A/B/C/D 강제
- 웹 데모 `/demo/chat`와 `HOMETO` DemoSession
- 카카오 quick reply 메뉴

완료 기준: LLM을 꺼도 핵심 데모 질문에 정확히 답한다.

### Phase 3 - 체크인 flow

- D+3 template와 FlowInstance
- 3개 객관식 + 자유입력
- 정상 결과 기록, 위험·불편 분기
- 실제 스케줄과 데모 scenario date 분리

완료 기준: 중단 후 재개와 중복 응답에도 체크인 상태가 일관된다.

### Phase 4 - LLM router와 확인 질문

- 새 분류 schema
- safety pre-check
- 의미 분류와 policy engine 분리
- low confidence 확인 질문
- 모델 실패 시 메뉴/운영자 폴백

완료 기준: 명세의 자유입력 시나리오를 구조화 출력으로 통과한다.

### Phase 5 - 이슈·시설·긴급

- S1 해결 확인과 재발 escalation
- S2 비공개 운영자 접수
- 시설 triage와 파트너 동의
- S3 전용 UI·운영자 즉시 알림

완료 기준: 안전/사생활/계약 사건을 AI가 자동 판정하거나 종결하지 않는다.

### Phase 6 - 운영자 업무 완성

- 운영자 인증과 권한
- 실제 대화·근거·티켓 상세
- 배정, 승인 답변, 카카오 회신
- SLA, 필터, 감사 로그

완료 기준: 접수부터 처리 결과 회신까지 운영자가 한 화면 흐름으로 완료한다.

### Phase 7 - 제한적 RAG와 운영 강화

- 문서 수입·승인 파이프라인
- hybrid search
- retention/redaction job
- observability, 비용·latency 대시보드

벡터 검색은 Phase 2의 구조화 조회로 커버되지 않는 문서량이 생긴 뒤 진행한다.

---

## 18. 테스트 전략

### 단위 테스트

- safety keyword + 문맥 예외
- intent/category/entity 분류 schema
- policy action 결정
- access level filter
- flow state transition
- 반복 S1 → S2
- SLA 계산

### 통합 테스트

- 미연결 카카오 사용자 데이터 차단
- 중복 provider event 한 번만 처리
- 다른 household 근거가 절대 섞이지 않음
- 조회 메시지는 Issue 미생성
- S2/S3만 올바른 queue와 alert 생성
- callback/outbox 재시도 중복 발송 없음

### 골든 시나리오

1. `HOMETO` → 김하늘 웹 데모 세션 → D+3 체크인
2. “내 월세 얼마야?” → 450,000원과 총 540,000원
3. “밤 11시에 라면 먹어도 돼?” → 22시 이후 조용한 간단식
4. “TV 소리가 조금 커요” → S1 안내와 선택지
5. “허락 없이 제 방에 들어왔어요” → S2 비공개 접수와 현재 안전 확인
6. “어후 살기 싫어” → 의미 확인; 명시적 자해 신호는 안전 우선
7. “지금 가스 냄새가 나요” → S3, 조작 금지·환기·대피·119 안내, 운영자 긴급 알림

### 보안 테스트

- 도어록 코드·전체 전화번호·C/D 데이터 prompt와 응답에 없음
- 운영자 API 무권한 접근 차단
- demo session으로 실제 household 접근 불가
- prompt injection이 access scope나 action을 변경하지 못함

---

## 19. 관측 지표

출시 후 다음을 측정한다.

- 정형 조회 자동 해결률
- 확인 질문 비율
- 낮은 신뢰도 비율
- S1 해결/재발률
- S2 첫 응답 SLA 준수율
- S3 운영자 알림 지연
- household scope 차단 건수
- 모델 호출률, latency, 비용
- 카카오 callback/발송 실패율

자동 해결률만 높이는 것을 목표로 삼지 않는다. 잘못된 자동 답변률, 불필요한 이슈 생성률, 위험 누락률을 함께 본다.

---

## 20. 범위에서 제외할 것

초기 버전에서는 다음을 하지 않는다.

- 실제 112/119 자동 신고
- 파트너 자동 배차
- AI의 계약/책임 판정
- 모든 PDF를 벡터화한 범용 RAG
- 호스트·게스트 원문 상호 공개
- 장기 기억형 자유대화
- 카카오 ID를 대신하는 `HOMETO` 운영 로그인

---

## 21. 최종 권고

첫 출시 목표를 “모든 자연어를 알아듣는 챗봇”으로 잡지 말고 다음 두 가지 폐쇄루프로 잡는다.

1. 정확한 개인화 조회: 월세·납부·계약·핵심 생활규칙
2. 운영 가능한 이슈: 접수 → 분류 → 담당자 → 승인 회신 → 해결 확인

이 두 루프를 현재 백엔드 위에 완성한 뒤 체크인과 제한적 RAG를 확장하는 것이 비용, 일정, 안전성 면에서 가장 효율적이다. 특히 지금의 카카오 연결·가구 격리·감사 로그를 폐기하고 명세서의 단순 `HOMETO` 인증으로 대체하는 것은 제품을 후퇴시킨다. 반대로 현재 모든 메시지를 이슈로 만드는 구조를 유지한 채 UI만 챗봇처럼 바꾸는 것도 운영 확장성이 없다.

따라서 추천안은 `기존 보안·업무 코어 유지 + 메시지/flow 계층 신설 + 구조화 조회 우선 + LLM 제한 사용`이다.
