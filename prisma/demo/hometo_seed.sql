-- DEMO ONLY: 가상 HOMETO 시나리오 데이터. 실제 계약이나 개인정보로 사용하지 않는다.

INSERT INTO "households" ("id", "created_at", "updated_at")
VALUES ('HT-NW-TEST-001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "updated_at" = EXCLUDED."updated_at";

INSERT INTO "members" ("id", "household_id", "role", "created_at", "updated_at")
VALUES
  ('GST-HOMETO-001', 'HT-NW-TEST-001', 'GUEST', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('HOST-HOMETO-001', 'HT-NW-TEST-001', 'HOST', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "household_id" = EXCLUDED."household_id",
  "role" = EXCLUDED."role",
  "updated_at" = EXCLUDED."updated_at";

INSERT INTO "contract_cycles" ("id", "household_id", "status", "starts_at", "ends_at", "created_at", "updated_at")
VALUES (
  'CONTRACT-HOMETO-2026-01', 'HT-NW-TEST-001', 'ACTIVE',
  TIMESTAMP '2026-05-30 15:00:00', TIMESTAMP '2026-11-29 12:00:00',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "household_id" = EXCLUDED."household_id",
  "status" = EXCLUDED."status",
  "starts_at" = EXCLUDED."starts_at",
  "ends_at" = EXCLUDED."ends_at",
  "updated_at" = EXCLUDED."updated_at";

INSERT INTO "contract_financial_terms" (
  "id", "contract_cycle_id", "deposit_krw", "monthly_rent_krw", "service_fee_krw",
  "utility_fixed_krw", "regular_total_krw", "payment_day", "status", "effective_from",
  "effective_to", "source_document_key", "source_locator", "created_at", "updated_at"
)
VALUES (
  'FIN-HOMETO-2026-01', 'CONTRACT-HOMETO-2026-01', 1000000, 450000, 50000,
  40000, 540000, 25, 'ACTIVE', DATE '2026-05-30', DATE '2026-11-29',
  'HOMETO-DEMO-DATASHEET-V1', 'PDF p.5, 4-1~4-2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "deposit_krw" = EXCLUDED."deposit_krw",
  "monthly_rent_krw" = EXCLUDED."monthly_rent_krw",
  "service_fee_krw" = EXCLUDED."service_fee_krw",
  "utility_fixed_krw" = EXCLUDED."utility_fixed_krw",
  "regular_total_krw" = EXCLUDED."regular_total_krw",
  "payment_day" = EXCLUDED."payment_day",
  "status" = EXCLUDED."status",
  "effective_from" = EXCLUDED."effective_from",
  "effective_to" = EXCLUDED."effective_to",
  "source_document_key" = EXCLUDED."source_document_key",
  "source_locator" = EXCLUDED."source_locator",
  "updated_at" = EXCLUDED."updated_at";

INSERT INTO "checkin_templates" (
  "id", "key", "version", "title", "questions", "status", "created_at", "updated_at"
)
VALUES (
  'CHECKIN-TEMPLATE-D3-V1', 'D3_INITIAL', 1, '입주 3일차 정기 체크인',
  '[
    {"key":"overall","type":"SINGLE_CHOICE","prompt":"지금 집에서의 생활은 전반적으로 어떠세요?","options":[{"value":"GOOD","label":"잘 지내고 있어요","signal":"NONE"},{"value":"SOME_DISCOMFORT","label":"조금 불편해요","signal":"REVIEW"},{"value":"VERY_UNCOMFORTABLE","label":"많이 불편해요","signal":"REVIEW"},{"value":"IMMEDIATE_HELP","label":"즉시 도움이 필요해요","signal":"EMERGENCY"}]},
    {"key":"relationship","type":"SINGLE_CHOICE","prompt":"호스트님과 함께 생활하는 것은 어떠세요?","options":[{"value":"COMFORTABLE","label":"편안해요","signal":"NONE"},{"value":"AWKWARD","label":"아직 어색해요","signal":"NONE"},{"value":"NEEDS_COORDINATION","label":"조율할 부분이 있어요","signal":"REVIEW"},{"value":"HARD_TO_SPEAK","label":"직접 말하기 어려워요","signal":"REVIEW"}]},
    {"key":"facility","type":"SINGLE_CHOICE","prompt":"방·욕실·주방·와이파이 등 시설은 문제없이 사용하고 계신가요?","options":[{"value":"NO_PROBLEM","label":"문제없어요","signal":"NONE"},{"value":"MINOR","label":"작은 불편이 있어요","signal":"CLASSIFY"},{"value":"REPAIR","label":"수리가 필요해요","signal":"REVIEW"},{"value":"SAFETY","label":"안전 문제가 있어요","signal":"EMERGENCY"}]},
    {"key":"free_text","type":"FREE_TEXT","prompt":"홈투게더가 확인했으면 하는 내용을 자유롭게 말씀해 주세요. 특별한 내용이 없다면 없어요라고 입력해 주세요."}
  ]'::jsonb,
  'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "questions" = EXCLUDED."questions",
  "status" = EXCLUDED."status",
  "updated_at" = EXCLUDED."updated_at";

INSERT INTO "checkin_schedules" (
  "id", "household_id", "contract_cycle_id", "member_id", "template_id", "stage",
  "scheduled_for", "status", "is_demo", "created_at", "updated_at"
)
VALUES (
  'CHECKIN-HOMETO-D3-DEMO', 'HT-NW-TEST-001', 'CONTRACT-HOMETO-2026-01',
  'GST-HOMETO-001', 'CHECKIN-TEMPLATE-D3-V1', 'D3',
  TIMESTAMPTZ '2026-06-02 19:00:00+09', 'SCHEDULED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "template_id" = EXCLUDED."template_id",
  "scheduled_for" = EXCLUDED."scheduled_for",
  "status" = EXCLUDED."status",
  "is_demo" = EXCLUDED."is_demo",
  "updated_at" = EXCLUDED."updated_at";

INSERT INTO "payment_schedules" (
  "id", "contract_cycle_id", "period_start", "period_end", "due_date", "amount_krw",
  "status", "paid_at", "created_at", "updated_at"
)
VALUES
  ('PAY-HOMETO-001', 'CONTRACT-HOMETO-2026-01', DATE '2026-05-30', DATE '2026-06-29', DATE '2026-05-27', 540000, 'PAID', TIMESTAMPTZ '2026-05-27 12:00:00+09', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PAY-HOMETO-002', 'CONTRACT-HOMETO-2026-01', DATE '2026-06-30', DATE '2026-07-29', DATE '2026-06-25', 540000, 'PAID', TIMESTAMPTZ '2026-06-24 12:00:00+09', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PAY-HOMETO-003', 'CONTRACT-HOMETO-2026-01', DATE '2026-07-30', DATE '2026-08-29', DATE '2026-07-25', 540000, 'PAID', TIMESTAMPTZ '2026-07-25 12:00:00+09', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PAY-HOMETO-004', 'CONTRACT-HOMETO-2026-01', DATE '2026-08-30', DATE '2026-09-29', DATE '2026-08-25', 540000, 'PAID', TIMESTAMPTZ '2026-08-24 12:00:00+09', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PAY-HOMETO-005', 'CONTRACT-HOMETO-2026-01', DATE '2026-09-30', DATE '2026-10-29', DATE '2026-09-25', 540000, 'SCHEDULED', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "period_start" = EXCLUDED."period_start",
  "period_end" = EXCLUDED."period_end",
  "due_date" = EXCLUDED."due_date",
  "amount_krw" = EXCLUDED."amount_krw",
  "status" = EXCLUDED."status",
  "paid_at" = EXCLUDED."paid_at",
  "updated_at" = EXCLUDED."updated_at";

INSERT INTO "knowledge_records" (
  "id", "household_id", "contract_cycle_id", "kind", "category", "key",
  "structured_value", "answer_text", "access_level", "status", "effective_from",
  "effective_to", "source_document_key", "source_locator", "created_at", "updated_at"
)
VALUES
  ('KN-HOMETO-QUIET-001', 'HT-NW-TEST-001', 'CONTRACT-HOMETO-2026-01', 'RULE', 'quiet_hours', 'daily_window', '{"start":"22:30","end":"07:00"}'::jsonb, '매일 22:30부터 다음 날 07:00까지는 조용한 시간입니다.', 'A', 'ACTIVE', DATE '2026-05-30', DATE '2026-11-29', 'HOMETO-DEMO-DATASHEET-V1', 'PDF p.6, 5-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('KN-HOMETO-KITCHEN-001', 'HT-NW-TEST-001', 'CONTRACT-HOMETO-2026-01', 'RULE', 'kitchen', 'general_window', '{"start":"06:30","end":"22:00","afterHours":"전자레인지 또는 찬 음식"}'::jsonb, '일반 조리는 06:30부터 22:00까지 가능합니다. 22:00 이후에는 전자레인지나 조용한 간단식만 가능합니다.', 'A', 'ACTIVE', DATE '2026-05-30', DATE '2026-11-29', 'HOMETO-DEMO-DATASHEET-V1', 'PDF p.6, 5-2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('KN-HOMETO-LAUNDRY-001', 'HT-NW-TEST-001', 'CONTRACT-HOMETO-2026-01', 'RULE', 'laundry', 'allowed_window', '{"days":["TUE","THU","SAT"],"start":"08:00","end":"21:00","dailyLimit":1}'::jsonb, '세탁은 화요일·목요일·토요일 08:00부터 21:00까지 가능하며 하루 1회를 기본으로 합니다.', 'A', 'ACTIVE', DATE '2026-05-30', DATE '2026-11-29', 'HOMETO-DEMO-DATASHEET-V1', 'PDF p.6, 5-4', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('KN-HOMETO-VISITOR-001', 'HT-NW-TEST-001', 'CONTRACT-HOMETO-2026-01', 'RULE', 'visitor', 'default_policy', '{"noticeHours":24,"maxGuests":1,"start":"10:00","end":"20:00","maxMinutes":120,"overnight":false}'::jsonb, '방문은 24시간 전에 요청해야 하며, 동성 방문객 1명이 10:00부터 20:00 사이 최대 2시간 방문할 수 있습니다. 숙박은 불가합니다.', 'A', 'ACTIVE', DATE '2026-05-30', DATE '2026-11-29', 'HOMETO-DEMO-DATASHEET-V1', 'PDF p.7, 6-3', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('KN-HOMETO-ROOM-001', 'HT-NW-TEST-001', 'CONTRACT-HOMETO-2026-01', 'ROOM', 'room', 'guest_room', '{"areaM2":8.4,"exclusive":true,"hostEntryRequiresPermission":true}'::jsonb, '게스트 전용방은 약 8.4㎡이며, 호스트도 허락 없이 출입할 수 없습니다.', 'A', 'ACTIVE', DATE '2026-05-30', DATE '2026-11-29', 'HOMETO-DEMO-DATASHEET-V1', 'PDF p.3, 2-2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('KN-HOMETO-STORAGE-001', 'HT-NW-TEST-001', 'CONTRACT-HOMETO-2026-01', 'ROOM', 'storage', 'kitchen', '{"fridge":"가운데 선반 1칸과 문 수납 1칸","freezer":"하단 서랍 1/2","cabinet":"싱크대 오른쪽 상부장 1칸"}'::jsonb, '주방에서는 냉장실 가운데 선반 1칸과 문 수납 1칸, 냉동실 하단 서랍 절반, 싱크대 오른쪽 상부장 1칸을 사용합니다.', 'A', 'ACTIVE', DATE '2026-05-30', DATE '2026-11-29', 'HOMETO-DEMO-DATASHEET-V1', 'PDF p.4, 3-3', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "structured_value" = EXCLUDED."structured_value",
  "answer_text" = EXCLUDED."answer_text",
  "access_level" = EXCLUDED."access_level",
  "status" = EXCLUDED."status",
  "effective_from" = EXCLUDED."effective_from",
  "effective_to" = EXCLUDED."effective_to",
  "source_document_key" = EXCLUDED."source_document_key",
  "source_locator" = EXCLUDED."source_locator",
  "updated_at" = EXCLUDED."updated_at";
