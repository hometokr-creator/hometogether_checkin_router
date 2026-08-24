CREATE TYPE "ModelRunStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'FALLBACK');

CREATE TABLE "model_runs" (
  "id" TEXT NOT NULL,
  "issue_id" TEXT,
  "task" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT,
  "status" "ModelRunStatus" NOT NULL,
  "prompt_template_key" TEXT NOT NULL,
  "prompt_template_version" INTEGER NOT NULL,
  "provider_prompt_id" TEXT,
  "provider_prompt_version" TEXT,
  "provider_response_id" TEXT,
  "input_hash" TEXT NOT NULL,
  "output" JSONB,
  "error_code" TEXT,
  "latency_ms" INTEGER,
  "input_tokens" INTEGER,
  "output_tokens" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "model_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "model_runs_issue_id_created_at_idx" ON "model_runs"("issue_id", "created_at");
CREATE INDEX "model_runs_task_status_created_at_idx" ON "model_runs"("task", "status", "created_at");
ALTER TABLE "model_runs" ADD CONSTRAINT "model_runs_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "model_runs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "model_runs" FROM anon, authenticated;
