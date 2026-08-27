# Home Together Residence Router

가구별 원장에 근거한 구조화 조회, 다단계 체크인, 안전 선검사와 운영 이슈 라우팅을 제공하는 거주 관리 챗봇 구현입니다.

## Run

```powershell
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## Verify

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Prisma 7 스키마 검증과 클라이언트 생성:

```powershell
$env:DATABASE_URL="postgresql://..."
npm run db:validate
npm run db:generate
```

## Current scope

- Next.js App Router 운영자 콘솔
- Zod 기반 분류 JSON 검증
- 결정론적 A/B/C 라우팅 규칙
- `POST /api/inbound/kakao` Route Handler 골격
- HH-002 소음 B 라우팅 골든 테스트
- 사람 검토 전 자동 발송 차단
- 카카오 채널 친구·연결 상태 기반 발신 eligibility
- Event API 실패 시 승인된 알림톡 또는 전화 폴백
- 미연결 사용자의 가구 원장 접근 차단
- 카카오 네이티브 순차 quickReplies 체크인 메시지
- PostgreSQL Prisma 스키마
- 해시 저장·만료·single-use 카카오 linking token 서비스
- 토큰 소비와 링크 생성을 위한 Prisma transaction repository
- `POST /api/channel-links/tokens` 운영자 토큰 발급 API
- `POST /api/channel-links/verify` 카카오 사용자 연결 검증 API
- 대화 메시지와 운영 이슈 분리: A 경로 조회는 대화로만 기록하고 B/C만 이슈 생성
- 계약 금액·납부 일정·생활규칙 구조화 조회 fast path
- HOMETO 가상 데이터 seed SQL
- 버전된 D+3 체크인 문항·일정·응답 모델
- 낙관적 잠금 기반 체크인 진행 상태와 중단 후 재개
- 의미 해석 전용 대화 intent와 제한된 OpenAI 구조화 출력
- 명시적 가스·화재·폭력·자해 위험의 결정론적 safety pre-check
- 의미 해석과 실제 행동을 분리한 policy engine
- 낮은 신뢰도 확인 질문과 모델 실패 시 규칙 기반 폴백
- S2/S3 원문 C 레벨 저장 및 일반 이벤트 payload 원문 복제 차단
- 시설 안전 확인 → 제한된 자가조치 → 해결 확인 → 미해결 이슈 전환 flow

## Conversation routing

카카오 일반 자유입력은 다음 순서로 처리합니다.

```text
safety pre-check
→ 결정론적 의미 해석
→ 불명확한 경우에만 OpenAI 의미 router
→ 서버 policy가 ANSWER / CLARIFY / RECORD / CREATE_ISSUE / EMERGENCY_GUIDANCE 결정
→ 기존 이슈 모델 호환 형식으로 저장
```

LLM 출력에는 실제 행동 필드가 없습니다. 모델은 intent, severity, risk 후보, 명시된 entity와 confidence만 제안하며 이슈 생성·긴급 안내·큐 선택은 서버 정책이 결정합니다. 시설 요청은 안전 확인 및 운영자 triage 전에는 파트너 큐로 직접 보내지 않습니다.

## Facility triage

안전 위험이 명시되지 않은 시설 문의는 바로 이슈를 만들지 않고 `FACILITY_TRIAGE` flow를 시작합니다.

```text
시설 문의
→ 연기·불꽃·가스·감전·누수 안전 확인
→ 안전하면 기기별 승인 자가조치 안내
→ 해결됨: event만 기록, Issue 없음
→ 미해결: S1 운영자 Issue + 24시간 ticket
→ 최근 30일 동일 시설 재발: S2 승격 + 8시간 ticket
→ 위험 응답: 자가조치 중단, S3 Issue + 1시간 ticket
```

공유기 초기화, 가스 밸브 조작, 분전반·배선·도어록·기기 본체 분해는 자가조치로 안내하지 않습니다. flow 응답은 낙관적 버전 검사로 중복 처리를 막고, 시작 시 채널 링크의 household·member·contract 범위를 DB에서 다시 확인합니다.

재발 판정도 동일 household·contract·member 범위에서만 수행하며 최근 30일 이슈 중 검증된 `FACILITY_TRIAGE` 기록과 동일 시설 종류만 계산합니다. 새 이슈에는 occurrence number, 최대 5개의 prior issue ID, 판정 기간과 reason code를 함께 기록합니다.

## Kakao Open Builder connection

실제 사용자 화면은 웹 데모가 아니라 카카오 챗봇 관리자센터의 기존 웰컴·`아이디 입력 후`·`정기 체크인` 블록을 사용합니다. 테스트봇에서만 `HOMETO` 별칭을 허용하려면 다음을 설정합니다.

```dotenv
KAKAO_DEMO_MODE=true
KAKAO_DEMO_BOT_IDS=6a890b8dbfeff424f85ba969
PROVIDER_USER_KEY_PEPPER=32자-이상의-별도-랜덤-문자열
```

`KAKAO_DEMO_BOT_IDS`는 쉼표로 여러 테스트봇을 허용할 수 있지만 운영봇 ID를 넣으면 안 됩니다. `HOMETO`는 payload의 `bot.id`가 allowlist와 일치할 때만 김하늘 가상 회원과 연결됩니다. 카카오 사용자키 원문은 저장하지 않고 pepper 해시만 저장합니다.

관리자센터 설정:

1. Skill URL을 `https://<배포주소>/api/inbound/kakao`로 등록합니다.
2. 기존 `아이디 입력 후` 블록에 이 Skill을 연결하고 응답을 스킬데이터로 사용합니다. 서버 응답은 현재 성공 문구와 네 메뉴를 그대로 반환합니다.
3. 기존 `정기 체크인` 블록에 같은 Skill을 연결합니다. 블록 이름이 정확히 `정기 체크인`이면 자동 인식하며, 명시적으로 연결하려면 action parameter `command=START_CHECKIN`을 추가합니다.
4. 자유입력 폴백 블록과 실제 조회·접수 블록도 같은 Skill에 연결합니다.
5. 저장 후 개발 채널 배포 및 봇테스트에서 `HOMETO`부터 확인합니다.

카카오 체크인은 객관식 quick reply의 사용자용 한글 라벨을 그대로 발화로 보내며, 서버가 현재 flow의 문항·버전과 다시 대조합니다. 자유입력 답변은 체크인 원문 보호를 위해 C 접근 레벨로 저장합니다.

## HOMETO structured demo data

스키마 마이그레이션 적용 후, 실제 고객 데이터가 없는 데모 환경에서만
`prisma/demo/hometo_seed.sql`을 실행합니다. 이 파일의 이름·주소·계약·납부·생활규칙은 모두 가상 데이터입니다.

구조화 조회가 우선 처리하는 예시:

```text
내 월세 얼마야?
다음 납부일은 언제야?
계약 언제까지야?
세탁 언제 가능해?
밤에 라면 끓여도 돼?
친구 데려와도 돼?
주방에서 어디 써?
```

이 질문들은 활성 계약 회차와 household 범위 안에서 숫자·날짜·승인된 규칙을 직접 조회합니다. 근거가 없을 때만 기존 분류·운영자 확인 경로로 폴백합니다.

## D+3 check-in flow

HOMETO seed에는 `CHECKIN-TEMPLATE-D3-V1`과 데모 일정이 포함됩니다. 체크인은 문항 순서와 현재 버전을 서버가 검증하며, 완료 전까지 `flow_instances`에 상태를 보관합니다.

- 같은 계약 회차·회원에게 진행 중 flow는 하나만 허용
- 이전 화면에서 재전송된 답변은 version conflict로 차단
- 즉시 도움·안전 문제는 최종 disposition을 `EMERGENCY`로 유지
- 자유입력 내용이 있으면 `NEEDS_CLASSIFICATION`으로 후속 분류
- 완료 시 응답, 일정 상태, 가구 이벤트를 한 트랜잭션으로 저장

### Web demo

마이그레이션과 `prisma/demo/hometo_seed.sql`을 데모 DB에 적용한 뒤 아래 환경 변수를 설정하면 `/demo`에서 전체 체크인 흐름을 실행할 수 있습니다.

```dotenv
DEMO_MODE=true
DEMO_SESSION_SECRET=32자-이상의-별도-랜덤-문자열
```

테스트 별칭은 `HOMETO`입니다. 로그인 성공 시 서명된 HttpOnly 쿠키가 발급되며, 체크인 시작·응답 API는 쿠키의 회원 및 계약 범위와 DB 레코드 소유 범위를 다시 대조합니다. 완료된 일정은 결과 화면을 다시 불러올 수 있지만 응답을 덮어쓰지는 않습니다.

## Inbound API shape

`POST /api/inbound/kakao`는 현재 카카오 어댑터가 정규화한 다음 형태를 받습니다.

```json
{
  "providerEventId": "provider-event-id",
  "providerUserKey": "provider-user-key",
  "identityStatus": "LINKED",
  "classification": {
    "intent": "COMPLAINT",
    "domain": "NOISE",
    "severity": "S2",
    "urgency": "SAME_DAY",
    "direction": "G_TO_H",
    "interventionPreference": "COORDINATE",
    "distressSignal": "EXPLICIT",
    "riskFlags": [],
    "confidence": 0.94,
    "evidenceMessageIds": ["message-id"],
    "reasonCodes": ["DISTRESS_EXPLICIT"]
  }
}
```

마이그레이션과 데모 seed는 원격 DB에 자동 적용하지 않습니다. 대상이 실제 운영 DB가 아닌지 확인한 뒤 별도로 적용해야 합니다.

토큰 발급 API는 `x-internal-api-key` 헤더가 필요하며, 활성 계약과 구성원의 가구 일치를 DB에서 다시 검사합니다. 검증 API는 토큰 원문을 저장하지 않고 카카오 사용자키도 pepper를 적용한 해시만 저장합니다.
