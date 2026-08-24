CREATE TYPE "HouseholdEventSource" AS ENUM ('INBOUND', 'CHECKIN', 'SYSTEM');
CREATE TYPE "IssueStatus" AS ENUM ('REPORTED', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'FOLLOWUP', 'CLOSED', 'REOPENED');
CREATE TYPE "IssueRoute" AS ENUM ('A', 'B', 'C');
CREATE TYPE "ActionTicketStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE "issues" (
  "id" TEXT NOT NULL,
  "household_id" TEXT NOT NULL,
  "contract_cycle_id" TEXT NOT NULL,
  "member_id" TEXT,
  "status" "IssueStatus" NOT NULL DEFAULT 'REPORTED',
  "route" "IssueRoute" NOT NULL,
  "intent" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "urgency" TEXT NOT NULL,
  "classification" JSONB NOT NULL,
  "opened_at" TIMESTAMP(3) NOT NULL,
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "household_events" (
  "id" TEXT NOT NULL,
  "household_id" TEXT NOT NULL,
  "contract_cycle_id" TEXT NOT NULL,
  "member_id" TEXT,
  "issue_id" TEXT,
  "source" "HouseholdEventSource" NOT NULL,
  "event_type" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "household_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "action_tickets" (
  "id" TEXT NOT NULL,
  "issue_id" TEXT NOT NULL,
  "status" "ActionTicketStatus" NOT NULL DEFAULT 'OPEN',
  "queue" TEXT NOT NULL,
  "due_at" TIMESTAMP(3) NOT NULL,
  "assigned_to" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "action_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "issues_household_id_status_opened_at_idx" ON "issues"("household_id", "status", "opened_at");
CREATE INDEX "issues_contract_cycle_id_status_idx" ON "issues"("contract_cycle_id", "status");
CREATE INDEX "issues_member_id_opened_at_idx" ON "issues"("member_id", "opened_at");
CREATE INDEX "household_events_household_id_occurred_at_idx" ON "household_events"("household_id", "occurred_at");
CREATE INDEX "household_events_contract_cycle_id_occurred_at_idx" ON "household_events"("contract_cycle_id", "occurred_at");
CREATE INDEX "household_events_member_id_occurred_at_idx" ON "household_events"("member_id", "occurred_at");
CREATE INDEX "household_events_issue_id_occurred_at_idx" ON "household_events"("issue_id", "occurred_at");
CREATE INDEX "action_tickets_issue_id_status_idx" ON "action_tickets"("issue_id", "status");
CREATE INDEX "action_tickets_status_due_at_idx" ON "action_tickets"("status", "due_at");

ALTER TABLE "issues" ADD CONSTRAINT "issues_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_contract_cycle_id_fkey" FOREIGN KEY ("contract_cycle_id") REFERENCES "contract_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "household_events" ADD CONSTRAINT "household_events_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "household_events" ADD CONSTRAINT "household_events_contract_cycle_id_fkey" FOREIGN KEY ("contract_cycle_id") REFERENCES "contract_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "household_events" ADD CONSTRAINT "household_events_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "household_events" ADD CONSTRAINT "household_events_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "action_tickets" ADD CONSTRAINT "action_tickets_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "issues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "household_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "action_tickets" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "issues", "household_events", "action_tickets" FROM anon, authenticated;
