CREATE TYPE "ContractDocumentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "ContractClauseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

CREATE TABLE "demo_contracts" (
  "id" TEXT NOT NULL,
  "contract_cycle_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "is_synthetic" BOOLEAN NOT NULL DEFAULT true,
  "status" "ContractDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "demo_contracts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "demo_contracts_synthetic_only" CHECK ("is_synthetic" = true)
);

CREATE TABLE "contract_clauses" (
  "id" TEXT NOT NULL,
  "contract_document_id" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "clause_number" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "effective_from" TIMESTAMP(3) NOT NULL,
  "effective_to" TIMESTAMP(3),
  "status" "ContractClauseStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_clauses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_clauses_effective_window" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from")
);

CREATE UNIQUE INDEX "demo_contracts_contract_cycle_id_version_key" ON "demo_contracts"("contract_cycle_id", "version");
CREATE INDEX "demo_contracts_contract_cycle_id_status_idx" ON "demo_contracts"("contract_cycle_id", "status");
CREATE INDEX "contract_clauses_contract_document_id_domain_status_idx" ON "contract_clauses"("contract_document_id", "domain", "status");
CREATE INDEX "contract_clauses_domain_status_effective_from_idx" ON "contract_clauses"("domain", "status", "effective_from");

ALTER TABLE "demo_contracts" ADD CONSTRAINT "demo_contracts_contract_cycle_id_fkey" FOREIGN KEY ("contract_cycle_id") REFERENCES "contract_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_clauses" ADD CONSTRAINT "contract_clauses_contract_document_id_fkey" FOREIGN KEY ("contract_document_id") REFERENCES "demo_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "demo_contracts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contract_clauses" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "demo_contracts", "contract_clauses" FROM anon, authenticated;

INSERT INTO "demo_contracts" ("id", "contract_cycle_id", "title", "version", "is_synthetic", "status", "updated_at")
SELECT 'demo-contract-codex-001', 'codex-checkin-cycle-001', '홈투게더 가상 거주 계약서', 1, true, 'ACTIVE', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "contract_cycles" WHERE "id" = 'codex-checkin-cycle-001')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "contract_clauses" ("id", "contract_document_id", "domain", "clause_number", "text", "effective_from", "status", "updated_at")
SELECT 'demo-clause-kitchen-001', 'demo-contract-codex-001', 'KITCHEN', '제5조', '주방은 오후 10시까지 사용할 수 있습니다.', TIMESTAMP '2026-01-01 00:00:00', 'ACTIVE', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "demo_contracts" WHERE "id" = 'demo-contract-codex-001')
ON CONFLICT ("id") DO NOTHING;
