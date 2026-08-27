CREATE TYPE "FlowType" AS ENUM ('CHECKIN', 'ISSUE_INTAKE', 'FACILITY_TRIAGE', 'MOVE_OUT', 'EMERGENCY_CONFIRMATION');
CREATE TYPE "FlowStatus" AS ENUM ('IN_PROGRESS', 'WAITING_USER', 'WAITING_OPERATOR', 'COMPLETED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "CheckinStage" AS ENUM ('D3', 'W2', 'MONTHLY', 'EXIT_D30');
CREATE TYPE "CheckinScheduleStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CheckinDisposition" AS ENUM ('OK', 'NEEDS_CLASSIFICATION', 'NEEDS_REVIEW', 'EMERGENCY');

CREATE TABLE "checkin_templates" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "questions" JSONB NOT NULL,
  "status" "StructuredRecordStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "checkin_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "checkin_templates_version_positive" CHECK ("version" > 0),
  CONSTRAINT "checkin_templates_title_nonempty" CHECK (length(trim("title")) > 0),
  CONSTRAINT "checkin_templates_questions_array" CHECK (jsonb_typeof("questions") = 'array')
);

CREATE TABLE "checkin_schedules" (
  "id" TEXT NOT NULL,
  "household_id" TEXT NOT NULL,
  "contract_cycle_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "stage" "CheckinStage" NOT NULL,
  "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
  "status" "CheckinScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
  "is_demo" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "checkin_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flow_instances" (
  "id" TEXT NOT NULL,
  "household_id" TEXT NOT NULL,
  "contract_cycle_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "conversation_id" TEXT,
  "checkin_schedule_id" TEXT,
  "type" "FlowType" NOT NULL,
  "status" "FlowStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "step_key" TEXT NOT NULL,
  "context" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "flow_instances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "flow_instances_version_positive" CHECK ("version" > 0),
  CONSTRAINT "flow_instances_step_key_nonempty" CHECK (length(trim("step_key")) > 0)
);

CREATE TABLE "checkin_responses" (
  "id" TEXT NOT NULL,
  "checkin_schedule_id" TEXT NOT NULL,
  "respondent_member_id" TEXT NOT NULL,
  "answers" JSONB NOT NULL,
  "free_text" TEXT,
  "disposition" "CheckinDisposition" NOT NULL,
  "completed_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checkin_responses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "checkin_responses_answers_object" CHECK (jsonb_typeof("answers") = 'object')
);

CREATE UNIQUE INDEX "checkin_templates_key_version_key" ON "checkin_templates"("key", "version");
CREATE INDEX "checkin_templates_key_status_version_idx" ON "checkin_templates"("key", "status", "version");
CREATE UNIQUE INDEX "checkin_schedules_contract_member_stage_scheduled_key" ON "checkin_schedules"("contract_cycle_id", "member_id", "stage", "scheduled_for");
CREATE INDEX "checkin_schedules_member_id_status_scheduled_for_idx" ON "checkin_schedules"("member_id", "status", "scheduled_for");
CREATE INDEX "checkin_schedules_household_id_status_scheduled_for_idx" ON "checkin_schedules"("household_id", "status", "scheduled_for");
CREATE INDEX "checkin_schedules_template_id_idx" ON "checkin_schedules"("template_id");
CREATE UNIQUE INDEX "flow_instances_checkin_schedule_id_key" ON "flow_instances"("checkin_schedule_id");
CREATE INDEX "flow_instances_contract_cycle_member_status_idx" ON "flow_instances"("contract_cycle_id", "member_id", "status");
CREATE INDEX "flow_instances_conversation_id_status_idx" ON "flow_instances"("conversation_id", "status");
CREATE INDEX "flow_instances_status_expires_at_idx" ON "flow_instances"("status", "expires_at");
CREATE UNIQUE INDEX "flow_instances_one_active_per_member_idx" ON "flow_instances"("contract_cycle_id", "member_id") WHERE "status" IN ('IN_PROGRESS', 'WAITING_USER');
CREATE UNIQUE INDEX "checkin_responses_checkin_schedule_id_key" ON "checkin_responses"("checkin_schedule_id");
CREATE INDEX "checkin_responses_respondent_completed_at_idx" ON "checkin_responses"("respondent_member_id", "completed_at");

ALTER TABLE "checkin_schedules" ADD CONSTRAINT "checkin_schedules_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkin_schedules" ADD CONSTRAINT "checkin_schedules_contract_cycle_id_fkey" FOREIGN KEY ("contract_cycle_id") REFERENCES "contract_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkin_schedules" ADD CONSTRAINT "checkin_schedules_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkin_schedules" ADD CONSTRAINT "checkin_schedules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checkin_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "flow_instances" ADD CONSTRAINT "flow_instances_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "flow_instances" ADD CONSTRAINT "flow_instances_contract_cycle_id_fkey" FOREIGN KEY ("contract_cycle_id") REFERENCES "contract_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "flow_instances" ADD CONSTRAINT "flow_instances_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "flow_instances" ADD CONSTRAINT "flow_instances_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "flow_instances" ADD CONSTRAINT "flow_instances_checkin_schedule_id_fkey" FOREIGN KEY ("checkin_schedule_id") REFERENCES "checkin_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checkin_responses" ADD CONSTRAINT "checkin_responses_checkin_schedule_id_fkey" FOREIGN KEY ("checkin_schedule_id") REFERENCES "checkin_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkin_responses" ADD CONSTRAINT "checkin_responses_respondent_member_id_fkey" FOREIGN KEY ("respondent_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "checkin_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checkin_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "flow_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checkin_responses" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "checkin_templates", "checkin_schedules", "flow_instances", "checkin_responses" FROM anon, authenticated;
