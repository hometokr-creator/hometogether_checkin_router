CREATE TYPE "StructuredRecordStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "PaymentScheduleStatus" AS ENUM ('SCHEDULED', 'PAID', 'OVERDUE', 'WAIVED');
CREATE TYPE "KnowledgeKind" AS ENUM ('RULE', 'ROOM', 'INVENTORY', 'CONTACT_POLICY');

CREATE TABLE "contract_financial_terms" (
  "id" TEXT NOT NULL,
  "contract_cycle_id" TEXT NOT NULL,
  "deposit_krw" INTEGER NOT NULL,
  "monthly_rent_krw" INTEGER NOT NULL,
  "service_fee_krw" INTEGER NOT NULL,
  "utility_fixed_krw" INTEGER NOT NULL,
  "regular_total_krw" INTEGER NOT NULL,
  "payment_day" INTEGER NOT NULL,
  "status" "StructuredRecordStatus" NOT NULL DEFAULT 'DRAFT',
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "source_document_key" TEXT NOT NULL,
  "source_locator" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_financial_terms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_financial_terms_nonnegative" CHECK (
    "deposit_krw" >= 0 AND "monthly_rent_krw" >= 0 AND
    "service_fee_krw" >= 0 AND "utility_fixed_krw" >= 0
  ),
  CONSTRAINT "contract_financial_terms_total" CHECK (
    "regular_total_krw" = "monthly_rent_krw" + "service_fee_krw" + "utility_fixed_krw"
  ),
  CONSTRAINT "contract_financial_terms_payment_day" CHECK ("payment_day" BETWEEN 1 AND 28),
  CONSTRAINT "contract_financial_terms_effective_window" CHECK (
    "effective_to" IS NULL OR "effective_to" >= "effective_from"
  )
);

CREATE TABLE "payment_schedules" (
  "id" TEXT NOT NULL,
  "contract_cycle_id" TEXT NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "due_date" DATE NOT NULL,
  "amount_krw" INTEGER NOT NULL,
  "status" "PaymentScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
  "paid_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_schedules_amount_positive" CHECK ("amount_krw" > 0),
  CONSTRAINT "payment_schedules_period" CHECK ("period_end" >= "period_start"),
  CONSTRAINT "payment_schedules_paid_at" CHECK (
    ("status" = 'PAID' AND "paid_at" IS NOT NULL) OR
    ("status" <> 'PAID' AND "paid_at" IS NULL)
  )
);

CREATE TABLE "knowledge_records" (
  "id" TEXT NOT NULL,
  "household_id" TEXT NOT NULL,
  "contract_cycle_id" TEXT NOT NULL,
  "kind" "KnowledgeKind" NOT NULL,
  "category" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "structured_value" JSONB NOT NULL,
  "answer_text" TEXT NOT NULL,
  "access_level" "InformationAccessLevel" NOT NULL DEFAULT 'A',
  "status" "StructuredRecordStatus" NOT NULL DEFAULT 'DRAFT',
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "source_document_key" TEXT NOT NULL,
  "source_locator" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_records_category_nonempty" CHECK (length(trim("category")) > 0),
  CONSTRAINT "knowledge_records_key_nonempty" CHECK (length(trim("key")) > 0),
  CONSTRAINT "knowledge_records_answer_nonempty" CHECK (length(trim("answer_text")) > 0),
  CONSTRAINT "knowledge_records_effective_window" CHECK (
    "effective_to" IS NULL OR "effective_to" >= "effective_from"
  )
);

CREATE UNIQUE INDEX "contract_financial_terms_contract_cycle_id_effective_from_key" ON "contract_financial_terms"("contract_cycle_id", "effective_from");
CREATE INDEX "contract_financial_terms_contract_cycle_id_status_effective_from_idx" ON "contract_financial_terms"("contract_cycle_id", "status", "effective_from");
CREATE UNIQUE INDEX "payment_schedules_contract_cycle_id_due_date_key" ON "payment_schedules"("contract_cycle_id", "due_date");
CREATE INDEX "payment_schedules_contract_cycle_id_status_due_date_idx" ON "payment_schedules"("contract_cycle_id", "status", "due_date");
CREATE UNIQUE INDEX "knowledge_records_contract_cycle_id_category_key_effective_key" ON "knowledge_records"("contract_cycle_id", "category", "key", "effective_from");
CREATE INDEX "knowledge_records_contract_cycle_id_kind_category_status_eff_idx" ON "knowledge_records"("contract_cycle_id", "kind", "category", "status", "effective_from");
CREATE INDEX "knowledge_records_household_id_status_effective_from_idx" ON "knowledge_records"("household_id", "status", "effective_from");

ALTER TABLE "contract_financial_terms" ADD CONSTRAINT "contract_financial_terms_contract_cycle_id_fkey" FOREIGN KEY ("contract_cycle_id") REFERENCES "contract_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_contract_cycle_id_fkey" FOREIGN KEY ("contract_cycle_id") REFERENCES "contract_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_records" ADD CONSTRAINT "knowledge_records_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_records" ADD CONSTRAINT "knowledge_records_contract_cycle_id_fkey" FOREIGN KEY ("contract_cycle_id") REFERENCES "contract_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contract_financial_terms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_records" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "contract_financial_terms", "payment_schedules", "knowledge_records" FROM anon, authenticated;
