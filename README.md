# Home Together Residence Router

가구별 원장에 근거해 인바운드 메시지를 A(근거 응답), B(운영자), C(시설 파트너)로 라우팅하는 v0 구현입니다.

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

실제 `DATABASE_URL`이 없어 migration 적용은 아직 수행하지 않았습니다. 필수 가상 데이터 번들도 없어 seed와 HH-003 근거 검색은 보류되어 있습니다.

토큰 발급 API는 `x-internal-api-key` 헤더가 필요하며, 활성 계약과 구성원의 가구 일치를 DB에서 다시 검사합니다. 검증 API는 토큰 원문을 저장하지 않고 카카오 사용자키도 pepper를 적용한 해시만 저장합니다.
